import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CardPostingsDialog } from '../cardpostings/cardpostings-dialog';
import moment from 'moment';
import { CardPostingsService } from 'src/app/services/cardpostings/cardpostings.service';
import { People } from 'src/app/models/people.model';
import { Categories } from 'src/app/models/categories.model';
import { Cards } from 'src/app/models/cards.model';
import { CardsPostings } from 'src/app/models/cardspostings.model';
import {
  NotificationPayload,
  NotificationReader,
} from 'capacitor-notification-reader/src';
import { Preferences } from '@capacitor/preferences';

@Component({
  selector: 'app-cards-notifications',
  templateUrl: './cardsnotifications.component.html',
  styleUrls: ['./cardsnotifications.component.scss'],
})
export class CardsNotificationsComponent implements OnInit {
  @Input() cardId?: number;
  @Input() reference?: string;
  @Input() peopleList?: People[];
  @Input() categoriesList?: Categories[];
  @Input() cardsList?: Cards[];
  @Input() cardsPostings?: CardsPostings[];

  @Output() peopleListChange = new EventEmitter<People[]>();
  @Output() categoriesListChange = new EventEmitter<Categories[]>();
  @Output() cardPostingCreated = new EventEmitter<CardsPostings>();

  private readonly STORAGE_KEY = 'persisted_notifications';

  notifications = [] as CardsPostings[];

  constructor(
    private dialog: MatDialog,
    private cardPostingsService: CardPostingsService
  ) { }

  async ngOnInit(): Promise<void> {
    console.log('[DEBUG] ngOnInit iniciado');

    // 1. Recarrega notificações do armazenamento
    const stored = await Preferences.get({ key: this.STORAGE_KEY });
    if (stored.value) {
      const parsed = JSON.parse(stored.value);
      this.notifications.push(...parsed);
      this.sortNotificationsByDate();
    }

    // 2. Busca notificações ativas do sistema
    try {
      const result = await NotificationReader.getActiveNotifications();
      console.log('[DEBUG] getActiveNotifications result:', result);

      for (const payload of result.notifications) {
        const cardPosting = this.parseNotification(payload);
        console.log('[DEBUG] Card posting gerado:', cardPosting);

        if (
          cardPosting &&
          !this.isDuplicate(cardPosting.note) &&
          !this.isCardPostingDuplicate(cardPosting.note)
        ) {
          this.notifications.unshift(cardPosting);
          this.sortNotificationsByDate();
          await this.saveNotificationsToStorage();
        }
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao buscar notificações ativas:', error);
    }

    // 3. Registra o listener para notificações futuras
    NotificationReader.addListener('notificationReceived', async (payload) => {
      console.log('[DEBUG] Nova notificação recebida:', payload);

      const cardPosting = this.parseNotification(payload);

      if (cardPosting) {
        this.notifications.unshift(cardPosting);
        this.sortNotificationsByDate();
        await this.saveNotificationsToStorage();
      }
    });
  }

  private sortNotificationsByDate(): void {
    this.notifications.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  private parseNotification(
    payload: NotificationPayload
  ): CardsPostings | null {
    const text = payload.text ?? '';
    const title = payload.title ?? '';
    const pkg = payload.package?.toLowerCase() ?? '';

    // C6 Bank
    if (
      (pkg.includes('c6') || title.toLowerCase().includes('crédito')) &&
      text.includes('no valor de R$')
    ) {
      try {
        const valorMatch = text.match(/R\$ ?([\d,.]+)/);
        const dataMatch = text.match(
          /dia (\d{2}\/\d{2}\/\d{4}) às (\d{2}:\d{2})/
        );
        const lojaMatch = text.match(/em (.+?),? foi aprovada/i);

        if (!valorMatch || !dataMatch || !lojaMatch) return null;

        const amount = parseFloat(
          valorMatch[1].replace('.', '').replace(',', '.')
        );
        const date = new Date(
          `${dataMatch[1].split('/').reverse().join('-')}T${dataMatch[2]}:00`
        );
        const description = lojaMatch[1].split(/\s{2,}/)[0].trim();

        return { amount, date, description, note: text } as CardsPostings;
      } catch {
        return null;
      }
    }

    // PicPay
    if (pkg.includes('picpay') || title.toLowerCase().includes('cashback')) {
      try {
        const valorMatch = text.match(/R\$ ?([\d,.]+)/);
        const lojaMatch = text.match(/em (.+?) (APROVADA|APROVADO)/i);

        if (!valorMatch || !lojaMatch) return null;

        const amount = parseFloat(
          valorMatch[1].replace('.', '').replace(',', '.')
        );
        const description = lojaMatch[1].trim();
        const date = new Date(); // Assume data atual

        return { amount, date, description, note: text } as CardsPostings;
      } catch {
        return null;
      }
    }

    // Outros bancos no futuro aqui...

    return null;
  }

  convertToCardPosting(notification: CardsPostings): void {
    const dialogRef = this.dialog.open(CardPostingsDialog, {
      width: '100%',
      maxWidth: '100%',
      data: {
        reference: this.reference,
        cardId: this.cardId,
        date: notification.date,
        description: notification.description,
        amount: notification.amount,
        totalAmount: notification.amount,
        parcels: 1,
        parcelNumber: 1,
        peopleList: this.peopleList,
        categoriesList: this.categoriesList,
        cardsList: this.cardsList,
        editing: false,
        adding: true,
        note: notification.note,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        //this.hideProgress = false;

        Date.prototype.toJSON = function () {
          return moment(this).format('YYYY-MM-DDThh:mm:00.000Z');
        };

        this.cardPostingsService.create(result).subscribe({
          next: (cardposting) => {
            this.removeNotification(notification);

            this.categoriesList = result.categoriesList;
            this.peopleList = result.peopleList;

            this.categoriesListChange.emit(this.categoriesList);
            this.peopleListChange.emit(this.peopleList);
            this.cardPostingCreated.emit(cardposting);
          },
        });
      }
    });
  }

  async removeNotification(notification: CardsPostings): Promise<void> {
    this.notifications = this.notifications.filter((n) => n !== notification);
    await this.saveNotificationsToStorage();
  }

  private async saveNotificationsToStorage(): Promise<void> {
    await Preferences.set({
      key: this.STORAGE_KEY,
      value: JSON.stringify(this.notifications),
    });
  }

  private isDuplicate(note: string | undefined): boolean {
    return this.notifications.some((n) => n.note === note);
  }

  private isCardPostingDuplicate(note: string | undefined): boolean {
    return this.cardsPostings?.some(p => p.note === note) ?? false;
  }
}
