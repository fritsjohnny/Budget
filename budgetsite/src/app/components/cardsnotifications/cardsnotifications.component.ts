import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
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
export class CardsNotificationsComponent implements OnInit, OnDestroy {
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

  private intervalId?: any;

  constructor(
    private dialog: MatDialog,
    private cardPostingsService: CardPostingsService
  ) { }

  async ngOnInit(): Promise<void> {
    // 1. Recarrega notificações do armazenamento
    const stored = await Preferences.get({ key: this.STORAGE_KEY });

    if (stored.value) {
      const parsed = JSON.parse(stored.value);
      this.notifications.push(...parsed);
      this.sortNotificationsByDate();
    }

    // 2. Busca notificações ativas do sistema
    await this.loadNotifications();

    this.intervalId = setInterval(() => {
      this.loadNotifications();
    }, 30000);

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

  private async loadNotifications(): Promise<void> {
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
  }

  private sortNotificationsByDate(): void {
    this.notifications.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  private parseNotification(
    payload: NotificationPayload
  ): CardsPostings | null {
    console.log('[DEBUG] Notification payload recebido:', payload);

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
        let description = lojaMatch[1].trim();

        // Remove sufixos como ", BRA", "SP", etc. no final
        description = description.replace(/[, ]+\b(BRA|USA|SP|RJ|MG|AM|CE|PE|BA|DF)\b[\s,.]*$/i, '');

        // Remove capital brasileira somente se estiver no FINAL da descrição
        description = description.replace(this.getCapitaisRegex(), '');

        // Normaliza espaços internos duplicados
        description = description.replace(/\s{2,}/g, ' ').trim();

        // Substitui múltiplos espaços internos por único espaço
        description = description.replace(/\s{2,}/g, ' ').trim();

        return { amount, date, description, note: text } as CardsPostings;
      } catch {
        return null;
      }
    }

    // PicPay
    if (pkg.includes('picpay') || title.toLowerCase().includes('cashback')) {
      try {
        const valorMatch = text.match(/R\$ ?([\d,.]+)/);
        const lojaMatch = text.match(/em (.+?) APROVADA/i);
        const parcelasMatch = text.match(/em (\d+)x/i); // ← detecta "2x", "3x" etc.

        if (!valorMatch || !lojaMatch) return null;

        const amount = parseFloat(
          valorMatch[1].replace('.', '').replace(',', '.')
        );

        let description = lojaMatch[1].trim();
        // Remove prefixo de parcelamento como "2x em", "3x em", etc.
        description = description.replace(/^\d+x em /i, '').trim();
        const parcels = parcelasMatch ? parseInt(parcelasMatch[1], 10) : 1;
        const date = new Date(); // Assume data atual

        return {
          amount,
          date,
          description,
          note: text,
          parcels
        } as CardsPostings;
      } catch {
        return null;
      }
    }

    // Nubank
    if (pkg === 'com.nu.production') {
      try {
        const valorMatch = text.match(/R\$ ?([\d,.]+)/);
        const lojaMatch = text.match(/em (.+?) para o cartão/i);

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

    // Cartão Amazon (SMS)
    if (text.toUpperCase().includes('CARTAO AMAZON')) {
      try {
        const valorMatch = text.match(/VALOR DE R\$\s*([\d,.]+)/i);
        const dataMatch = text.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
        const parcelasMatch = text.match(/em\s+(\d{1,2})\s*[xX]\b/); // opcional

        // 1) Tenta extrair a loja quando há parcelamento (em X)
        let lojaMatch = text.match(/em\s+\d+\s*[xX]\s*,?\s*(.+?)\./i);

        // 2) Fallback: sem parcelamento — pega loja após a vírgula do "VALOR DE R$..."
        if (!lojaMatch) {
          lojaMatch = text.match(/VALOR DE R\$\s*[\d,.]+\s*,\s*(.+?)\./i);
        }

        if (!valorMatch || !dataMatch || !lojaMatch) return null;

        const amount = parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.'));
        const date = new Date(`${dataMatch[1].split('/').reverse().join('-')}T${dataMatch[2]}:00`);
        const parcels = parcelasMatch ? parseInt(parcelasMatch[1], 10) : 1;

        // Normaliza descrição (tira espaços múltiplos)
        const description = lojaMatch[1].replace(/\s{2,}/g, ' ').trim();

        return { amount, date, description, note: text, parcels } as CardsPostings;
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
        parcels: notification.parcels || 1,
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

  // Transforma um texto em um padrão regex que aceita versões com e sem acento
  private toAccentInsensitivePattern(text: string): string {
    // remove acentos para obter as letras "base"
    const base = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // substitui vogais/ç por classes que aceitam todas as variantes com/sem acento
    return base
      .replace(/a/gi, '[aàáâãä]')
      .replace(/e/gi, '[eèéêë]')
      .replace(/i/gi, '[iìíîï]')
      .replace(/o/gi, '[oòóôõö]')
      .replace(/u/gi, '[uùúûü]')
      .replace(/c/gi, '[cç]');
  }

  // Lista enxuta (com acentos corretos, apenas uma vez)
  private getCapitaisBrasilBase(): string[] {
    return [
      'RIO BRANCO', 'MACEIÓ', 'MACAPÁ', 'MANAUS', 'SALVADOR', 'FORTALEZA',
      'BRASÍLIA', 'VITÓRIA', 'GOIÂNIA', 'SÃO LUÍS', 'CUIABÁ', 'CAMPO GRANDE',
      'BELO HORIZONTE', 'BELÉM', 'JOÃO PESSOA', 'CURITIBA', 'RECIFE',
      'TERESINA', 'RIO DE JANEIRO', 'NATAL', 'PORTO ALEGRE', 'PORTO VELHO',
      'BOA VISTA', 'FLORIANÓPOLIS', 'SÃO PAULO', 'ARACAJU', 'PALMAS'
    ];
  }

  // Gera UMA regex acento‑insensível para remover a capital se estiver no final
  private getCapitaisRegex(): RegExp {
    const patterns = this.getCapitaisBrasilBase()
      .map(c => this.toAccentInsensitivePattern(c));
    // \s+  (espaço antes), (capital) no fim, seguido de espaços/vírgula/ponto opcionais
    return new RegExp(`\\s+(?:${patterns.join('|')})\\b[\\s,.]*$`, 'i');
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
