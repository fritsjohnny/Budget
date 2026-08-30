import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { CardPostingsDialog } from '../cardpostings/cardpostings-dialog/cardpostings-dialog';
import { CardPostingsModernDialog } from '../cardpostings/cardpostings-dialog/cardpostings-modern-dialog';
import { CardPostingsService } from 'src/app/services/cardpostings/cardpostings.service';
import { People } from 'src/app/models/people.model';
import { Categories } from 'src/app/models/categories.model';
import { Cards } from 'src/app/models/cards.model';
import { CardsPostings } from 'src/app/models/cardspostings.model';
import {
  NotificationPayload,
  NotificationReader,
  PluginListenerHandle,
} from 'capacitor-notification-reader/src';
import { Preferences } from '@capacitor/preferences';
import { Messenger } from 'src/app/common/messenger';
import { CardsInvoiceClosingService } from 'src/app/services/cardsinvoiceclosing/cardsinvoiceclosing.service';
import { finalize, map, switchMap } from 'rxjs/operators';
import { prepareApiDates } from 'src/app/utils/api-date.util';

interface CardNotification extends CardsPostings {
  sourceAppPackageName?: string;
  notificationReceivedAt?: string;
}

export interface CardNotificationContext {
  card: Cards;
  reference: string;
}

@Component({
  selector: 'app-cards-notifications',
  templateUrl: './cardsnotifications.component.html',
  styleUrls: ['./cardsnotifications.component.scss'],
})
export class CardsNotificationsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() modernLayout: boolean = false;

  @Input() cardId?: number;
  @Input() reference?: string;
  @Input() peopleList?: People[];
  @Input() categoriesList?: Categories[];
  @Input() cardsList?: Cards[];
  @Input() cardsPostings?: CardsPostings[];
  @Input() notificationReloadRequest = 0;
  @Input() deletedCardPosting?: CardsPostings;

  @Output() peopleListChange = new EventEmitter<People[]>();
  @Output() categoriesListChange = new EventEmitter<Categories[]>();
  @Output() cardPostingCreated = new EventEmitter<CardsPostings>();
  @Output() cardPostingSavingChange = new EventEmitter<boolean>();
  @Output() notificationContextChange = new EventEmitter<CardNotificationContext>();
  @Output() notificationsCountChange = new EventEmitter<number>();

  private readonly STORAGE_KEY = 'persisted_notifications';
  private readonly PROCESSED_STORAGE_KEY = 'processed_notifications';
  private readonly DISMISSED_STORAGE_KEY = 'dismissed_notifications';

  notifications = [] as CardNotification[];

  private readonly processedNotificationKeys = new Set<string>();
  private readonly dismissedNotificationKeys = new Set<string>();
  private readonly pendingNotificationKeys = new Set<string>();
  private readonly knownCardPostings: CardsPostings[] = [];
  private readonly loadingCardPostingRanges = new Map<string, Promise<void>>();
  private readonly loadedCardPostingRanges = new Set<string>();
  private intervalId?: ReturnType<typeof setInterval>;
  private notificationListener?: PluginListenerHandle;
  private pendingNotificationHandled = false;
  private pendingNotificationPayload?: NotificationPayload;
  private pendingNotificationRequested = false;
  private readonly handlePendingNotificationRouteReady = (event: Event): void => {
    const payload = (event as CustomEvent<NotificationPayload>).detail;

    if (payload) {
      this.pendingNotificationPayload = payload;
    }

    this.pendingNotificationHandled = false;
    this.pendingNotificationRequested = true;
    void this.tryOpenPendingNotification();
  };

  private loadingNotifications = false;
  private initialized = false;
  validatingInvoiceClosing = false;

  constructor(
    private dialog: MatDialog,
    private cardPostingsService: CardPostingsService,
    private messenger: Messenger,
    private invoiceClosingService: CardsInvoiceClosingService
  ) { }

  async ngOnInit(): Promise<void> {
    this.pendingNotificationRequested = !!localStorage.getItem('pendingCardNotificationOpen');
    window.addEventListener('card-notification-route-ready', this.handlePendingNotificationRouteReady);

    await this.loadProcessedNotifications();
    await this.loadDismissedNotifications();
    await this.restoreNotificationsFromStorage();
    await this.loadExistingCardPostings(this.notifications);
    await this.reconcileNotificationsWithCardPostings();

    this.notificationListener = await NotificationReader.addListener(
      'notificationReceived',
      (payload) => {
        console.log('[DEBUG] Nova notificação recebida:', payload);
        void this.addNotificationFromPayload(payload);
      }
    );

    await this.loadNotifications();

    this.intervalId = setInterval(() => {
      void this.loadNotifications();
    }, 30000);

    this.initialized = true;
    await this.reconcileNotificationsWithCardPostings();
    if (this.pendingNotificationRequested) {
      await this.tryOpenPendingNotification();
    }
  }

  private async loadProcessedNotifications(): Promise<void> {
    const stored = await Preferences.get({ key: this.PROCESSED_STORAGE_KEY });

    if (!stored.value) return;

    try {
      const parsed: unknown = JSON.parse(stored.value);

      if (Array.isArray(parsed)) {
        for (const key of parsed) {
          if (typeof key === 'string' && key.trim()) {
            this.processedNotificationKeys.add(key);
          }
        }
      }
    } catch (error) {
      console.error('[DEBUG] Não foi possível restaurar notificações processadas:', error);
    }
  }

  private async loadDismissedNotifications(): Promise<void> {
    const stored = await Preferences.get({ key: this.DISMISSED_STORAGE_KEY });

    if (!stored.value) return;

    try {
      const parsed: unknown = JSON.parse(stored.value);

      if (Array.isArray(parsed)) {
        for (const key of parsed) {
          if (typeof key === 'string' && key.trim()) {
            this.dismissedNotificationKeys.add(key);
          }
        }
      }
    } catch (error) {
      console.error('[DEBUG] Não foi possível restaurar notificações desconsideradas:', error);
    }
  }

  private async restoreNotificationsFromStorage(): Promise<void> {
    const stored = await Preferences.get({ key: this.STORAGE_KEY });

    if (!stored.value) {
      this.emitNotificationsCount();
      return;
    }

    try {
      const parsed: unknown = JSON.parse(stored.value);

      if (Array.isArray(parsed)) {
        this.notifications = parsed.filter((notification): notification is CardNotification =>
          !!notification &&
          typeof notification === 'object' &&
          !this.isProcessedNotification(notification as CardNotification) &&
          !this.isDismissedNotification(notification as CardNotification) &&
          !this.isCardPostingDuplicate(notification as CardNotification)
        );
        this.sortNotificationsByDate();
      }
    } catch (error) {
      console.error('[DEBUG] Não foi possível restaurar notificações persistidas:', error);
    }

    await this.saveNotificationsToStorage();
    this.emitNotificationsCount();
  }

  private async loadNotifications(): Promise<void> {
    if (this.loadingNotifications) return;

    this.loadingNotifications = true;

    try {
      const result = await NotificationReader.getActiveNotifications();
      console.log('[DEBUG] getActiveNotifications result:', result);

      for (const payload of result.notifications) {
        await this.addNotificationFromPayload(payload);
      }
    } catch (error) {
      console.error('[DEBUG] Erro ao buscar notificações ativas:', error);
    } finally {
      this.loadingNotifications = false;
      this.emitNotificationsCount();
    }
  }

  private async addNotificationFromPayload(payload: NotificationPayload): Promise<void> {
    const cardPosting = this.parseNotification(payload);
    console.log('[DEBUG] Card posting gerado:', cardPosting);

    if (!cardPosting) return;

    await this.loadExistingCardPostings([cardPosting]);

    const notificationKey = this.getNotificationKey(cardPosting);
    const processedNotificationWasReleased =
      this.releaseProcessedNotificationIfPostingWasDeleted(cardPosting);

    if (processedNotificationWasReleased) {
      await this.saveNotificationsToStorage();
    }

    if (
      !notificationKey ||
      this.isDismissedNotification(cardPosting) ||
      this.isProcessedNotification(cardPosting) ||
      this.isDuplicate(cardPosting) ||
      this.isCardPostingDuplicate(cardPosting) ||
      this.pendingNotificationKeys.has(notificationKey)
    ) {
      return;
    }

    this.pendingNotificationKeys.add(notificationKey);

    try {
      this.notifications.unshift(cardPosting);
      this.sortNotificationsByDate();
      await this.saveNotificationsToStorage();
      this.emitNotificationsCount();
    } finally {
      this.pendingNotificationKeys.delete(notificationKey);
    }
  }

  private sortNotificationsByDate(): void {
    this.notifications.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  private parseNotification(
    payload: NotificationPayload
  ): CardNotification | null {
    console.log('[DEBUG] Notification payload recebido:', payload);

    const text = payload.text ?? '';
    const title = payload.title ?? '';
    const pkg = payload.package?.trim().toLowerCase() ?? '';
    const sourceAppPackageName = pkg || undefined;
    const receivedDate = this.getPayloadReceivedDate(payload);
    const notificationReceivedAt = receivedDate?.toISOString();

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

        return {
          amount,
          date,
          description,
          note: text,
          sourceAppPackageName,
          notificationReceivedAt
        } as CardNotification;
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
        const date = receivedDate ?? new Date();

        return {
          amount,
          date,
          description,
          note: text,
          parcels,
          sourceAppPackageName,
          notificationReceivedAt
        } as CardNotification;
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
        const date = receivedDate ?? new Date();

        return {
          amount,
          date,
          description,
          note: text,
          sourceAppPackageName,
          notificationReceivedAt
        } as CardNotification;
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

        return {
          amount,
          date,
          description,
          note: text,
          parcels,
          sourceAppPackageName,
          notificationReceivedAt
        } as CardNotification;
      } catch {
        return null;
      }
    }

    // Outros bancos no futuro aqui...

    return null;
  }

  private async tryOpenPendingNotification(): Promise<void> {
    if (!this.pendingNotificationRequested || this.pendingNotificationHandled || !this.cardsList?.length) return;

    const storedPayload = localStorage.getItem('pendingCardNotificationPayload');
    let storedNotification: NotificationPayload | undefined;

    if (storedPayload) {
      try {
        storedNotification = JSON.parse(storedPayload) as NotificationPayload;
      } catch {
        localStorage.removeItem('pendingCardNotificationPayload');
      }
    }

    const payload = this.pendingNotificationPayload ??
      storedNotification ??
      (await NotificationReader.getPendingNotification()).notification;

    if (!payload) {
      this.pendingNotificationRequested = false;
      localStorage.removeItem('pendingCardNotificationOpen');
      localStorage.removeItem('pendingCardNotificationPayload');
      return;
    }

    const cardPosting = this.parseNotification(payload);
    if (!cardPosting) {
      await this.acknowledgePendingNotificationOpen();
      return;
    }

    if (this.convertToCardPosting(cardPosting, true)) {
      this.pendingNotificationHandled = true;
      this.pendingNotificationRequested = false;
    }
  }

  private async acknowledgePendingNotificationOpen(): Promise<void> {
    this.pendingNotificationPayload = undefined;
    this.pendingNotificationRequested = false;
    localStorage.removeItem('pendingCardNotificationOpen');
    localStorage.removeItem('pendingCardNotificationPayload');

    try {
      await NotificationReader.clearPendingNotification();
    } catch (error) {
      console.error('[DEBUG] Não foi possível confirmar a abertura da notificação:', error);
    }
  }

  private getPayloadReceivedDate(payload: NotificationPayload): Date | null {
    if (payload.receivedAt === undefined || payload.receivedAt === null) return null;

    const receivedDate = new Date(payload.receivedAt);
    return Number.isNaN(receivedDate.getTime()) ? null : receivedDate;
  }

  private findCardByNotificationText(notification: CardNotification): Cards | undefined {
    const normalizedNote = this.normalizeCardText(notification.note);

    if (!normalizedNote) return undefined;

    const noteWithBoundaries = ' ' + normalizedNote + ' ';
    const matchingCards = this.cardsList
      ?.map(card => ({
        card,
        normalizedName: this.normalizeCardText(card.name),
      }))
      .filter(item =>
        item.normalizedName.length >= 3 &&
        !['cartao', 'card', 'credito', 'credit', 'visa', 'mastercard'].includes(item.normalizedName) &&
        noteWithBoundaries.includes(' ' + item.normalizedName + ' ')
      )
      .sort((first, second) => second.normalizedName.length - first.normalizedName.length);

    return matchingCards?.[0]?.card;
  }

  private normalizeCardText(value?: string): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  convertToCardPosting(notification: CardNotification, fromPendingNotification = false): boolean {
    const notificationDate = this.getNotificationDate(notification.date);

    if (!notificationDate) {
      this.messenger.errorHandler('A data da notificação é inválida.');
      return false;
    }

    const initialReference = this.getNotificationReference(notificationDate);
    const sourceAppPackageName = notification.sourceAppPackageName?.trim().toLowerCase();
    const selectedCard = this.cardId && this.cardId > 0
      ? this.cardsList?.find(card => card.id === this.cardId)
      : undefined;
    const textCard = this.findCardByNotificationText(notification);
    const appCard = sourceAppPackageName
      ? this.cardsList?.find(card => card.appPackageName?.trim().toLowerCase() === sourceAppPackageName)
      : undefined;
    const targetCard = textCard ?? appCard ?? selectedCard;

    if (!targetCard?.id || targetCard.id <= 0) {
      this.messenger.errorHandler(
        selectedCard
          ? 'O cartão selecionado não está disponível para transformar esta notificação em lançamento.'
          : sourceAppPackageName
            ? 'Nenhum cartão está configurado para o aplicativo que gerou esta notificação.'
            : 'Selecione um cartão específico para transformar esta notificação em lançamento.'
      );
      return false;
    }

    if (this.validatingInvoiceClosing) {
      if (fromPendingNotification) {
        window.setTimeout(() => void this.tryOpenPendingNotification(), 250);
      }
      return false;
    }

    const targetCardId = targetCard.id;

    this.validatingInvoiceClosing = true;
    this.invoiceClosingService.ensure(targetCardId, initialReference).pipe(
      switchMap(initialClosing => {
        const targetReference = this.resolveNotificationReference(
          notificationDate,
          initialReference,
          initialClosing.closingDate
        );

        if (!targetReference) {
          throw new Error('Não foi possível identificar a referência correta da notificação.');
        }

        if (this.cardId !== targetCardId || this.reference !== targetReference) {
          this.notificationContextChange.emit({ card: targetCard, reference: targetReference });
        }

        return this.invoiceClosingService.preparePosting(targetCardId, targetReference).pipe(
          map(invoiceClosing => ({ targetReference, invoiceClosing }))
        );
      }),
      finalize(() => this.validatingInvoiceClosing = false)
    ).subscribe({
      next: ({ targetReference, invoiceClosing }) => {
        const dialogRef = this.dialog.open(this.modernLayout ? CardPostingsModernDialog : CardPostingsDialog, {
          width: '100%',
          maxWidth: '100%',
          panelClass: this.modernLayout ? 'modern-entry-dialog-panel' : undefined,
          data: {
            reference: targetReference,
            cardId: targetCardId,
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
            provisioned: false,
            invoiceClosing,
            allowClosedInvoiceOperation: false,
          },
        });

        if (fromPendingNotification) {
          void this.acknowledgePendingNotificationOpen();
        }

        dialogRef.afterClosed().subscribe((result) => {
          if (!result) {
            if (fromPendingNotification) this.pendingNotificationHandled = false;
            return;
          }

          this.cardPostingSavingChange.emit(true);

          const payload = prepareApiDates(result, ['date', 'dueDate']);
          this.cardPostingsService.createFromNotification(payload).subscribe({
            next: async (cardposting) => {
              await this.removeNotification(notification);

              if (fromPendingNotification) {
                await NotificationReader.clearPendingNotification();
              }

              this.categoriesList = result.categoriesList;
              this.peopleList = result.peopleList;

              this.categoriesListChange.emit(this.categoriesList);
              this.peopleListChange.emit(this.peopleList);
              this.cardPostingCreated.emit(cardposting);
            },
            error: () => {
              this.cardPostingSavingChange.emit(false);
              if (fromPendingNotification) this.pendingNotificationHandled = false;
            },
          });
        });
      },
      error: () => {
        if (fromPendingNotification) {
          this.pendingNotificationHandled = false;
          this.pendingNotificationRequested = true;
        }
      },
    });

    return true;
  }

  private getNotificationDate(date: Date | string): Date | null {
    const notificationDate = date instanceof Date ? new Date(date.getTime()) : new Date(date);

    return Number.isNaN(notificationDate.getTime()) ? null : notificationDate;
  }

  private getNotificationReference(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');

    return `${year}${month}`;
  }

  private resolveNotificationReference(
    notificationDate: Date,
    initialReference: string,
    closingDate: Date | string
  ): string | null {
    const normalizedNotificationDate = new Date(notificationDate.getTime());
    const normalizedClosingDate = new Date(closingDate);

    if (Number.isNaN(normalizedClosingDate.getTime())) return null;

    normalizedNotificationDate.setHours(0, 0, 0, 0);
    normalizedClosingDate.setHours(0, 0, 0, 0);

    // A data configurada marca o início da nova fatura; somente compras anteriores permanecem na referência atual.
    if (normalizedNotificationDate.getTime() < normalizedClosingDate.getTime()) {
      return initialReference;
    }

    const referenceDate = new Date(
      Number(initialReference.substring(0, 4)),
      Number(initialReference.substring(4, 6)) - 1,
      1
    );

    referenceDate.setMonth(referenceDate.getMonth() + 1);

    return this.getNotificationReference(referenceDate);
  }

  async dismissNotification(notification: CardNotification): Promise<void> {
    await this.removeNotification(notification, true);
  }

  private async removeNotification(
    notification: CardNotification,
    dismissed = false
  ): Promise<void> {
    const notificationKey = this.getNotificationKey(notification);

    if (notificationKey) {
      this.processedNotificationKeys.add(notificationKey);
      if (dismissed) this.dismissedNotificationKeys.add(notificationKey);
    }

    this.notifications = this.notifications.filter((item) =>
      item !== notification &&
      (!notificationKey || this.getNotificationKey(item) !== notificationKey)
    );
    this.emitNotificationsCount();
    await this.saveNotificationsToStorage();
  }

  private emitNotificationsCount(): void {
    this.notificationsCountChange.emit(this.notifications.length);
  }

  private async saveNotificationsToStorage(): Promise<void> {
    await Promise.all([
      Preferences.set({
        key: this.STORAGE_KEY,
        value: JSON.stringify(this.notifications),
      }),
      Preferences.set({
        key: this.PROCESSED_STORAGE_KEY,
        value: JSON.stringify([...this.processedNotificationKeys]),
      }),
      Preferences.set({
        key: this.DISMISSED_STORAGE_KEY,
        value: JSON.stringify([...this.dismissedNotificationKeys]),
      }),
    ]);
  }

  private addKnownCardPosting(posting: CardsPostings): void {
    if (!posting.note) return;

    if (posting.id !== undefined && this.knownCardPostings.some(item => item.id === posting.id)) {
      return;
    }

    this.knownCardPostings.push(posting);
  }

  private async loadExistingCardPostings(notifications: CardNotification[]): Promise<void> {
    this.cardsPostings?.forEach((posting) => {
      const normalizedNote = this.normalizeNotificationText(posting.note);

      if (normalizedNote) {
        this.addKnownCardPosting(posting);
      }
    });

    const references = notifications
      .map(notification => this.getNotificationDate(notification.date))
      .filter((date): date is Date => !!date)
      .map(date => this.getNotificationReference(date));

    if (references.length === 0) return;

    const initialReference = references
      .map(reference => this.shiftReference(reference, 0))
      .sort()[0];
    const finalReference = references
      .map(reference => this.shiftReference(reference, 1))
      .sort()
      .pop();

    if (!initialReference || !finalReference) return;

    const rangeKey = `${initialReference}-${finalReference}`;
    if (this.loadedCardPostingRanges.has(rangeKey)) return;

    const runningRequest = this.loadingCardPostingRanges.get(rangeKey);
    if (runningRequest) {
      await runningRequest;
      return;
    }

    const request = new Promise<void>((resolve) => {
      this.cardPostingsService.readByReferences(initialReference, finalReference).subscribe({
        next: (postings) => {
          postings.forEach((posting) => {
            const normalizedNote = this.normalizeNotificationText(posting.note);

            if (normalizedNote) {
              this.addKnownCardPosting(posting);
            }
          });

          this.loadedCardPostingRanges.add(rangeKey);
        },
        error: (error) => {
          console.error('[DEBUG] Não foi possível consultar lançamentos para deduplicação:', error);
          resolve();
        },
        complete: () => resolve(),
      });
    });

    this.loadingCardPostingRanges.set(rangeKey, request);

    try {
      await request;
    } finally {
      this.loadingCardPostingRanges.delete(rangeKey);
    }
  }

  private shiftReference(reference: string, months: number): string {
    const referenceDate = new Date(
      Number(reference.substring(0, 4)),
      Number(reference.substring(4, 6)) - 1 + months,
      1
    );

    return this.getNotificationReference(referenceDate);
  }

  private deduplicateNotifications(): void {
    const identities = new Set<string>();

    this.notifications = this.notifications.filter(notification => {
      const identity = this.getNotificationIdentitySuffix(notification);

      if (!identity || identities.has(identity)) return false;

      identities.add(identity);
      return true;
    });
  }

  private async reconcileNotificationsWithCardPostings(): Promise<void> {
    this.cardsPostings?.forEach(posting => this.addKnownCardPosting(posting));
    this.deduplicateNotifications();
    const originalLength = this.notifications.length;

    this.notifications = this.notifications.filter((notification) =>
      !this.isProcessedNotification(notification) &&
      !this.isCardPostingDuplicate(notification)
    );

    if (this.notifications.length !== originalLength) {
      await this.saveNotificationsToStorage();
      this.emitNotificationsCount();
    }
  }

  private getNotificationReceivedTimestamp(
    notification: Pick<CardNotification, 'note' | 'date'> & { notificationReceivedAt?: string }
  ): number | null {
    const dateMatch = notification.note?.match(
      /dia (\d{2}\/\d{2}\/\d{4}) às (\d{2}):(\d{2})/i
    ) ?? notification.note?.match(
      /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}):(\d{2})/
    );

    if (dateMatch) {
      const [, dateText, hours, minutes] = dateMatch;
      const date = new Date(
        `${dateText.split('/').reverse().join('-')}T${hours}:${minutes}:00`
      );

      if (!Number.isNaN(date.getTime())) return date.getTime();
    }

    const receivedAt = notification.notificationReceivedAt
      ? new Date(notification.notificationReceivedAt)
      : null;

    if (receivedAt && !Number.isNaN(receivedAt.getTime())) {
      return receivedAt.getTime();
    }

    const notificationDate = this.getNotificationDate(notification.date);
    return notificationDate?.getTime() ?? null;
  }

  private getNotificationKey(
    notification: Pick<CardNotification, 'note' | 'sourceAppPackageName' | 'date'> & {
      notificationReceivedAt?: string;
    }
  ): string {
    const note = this.normalizeNotificationText(notification.note);
    const notificationTimestamp = this.getNotificationReceivedTimestamp(notification);

    if (!note || notificationTimestamp === null) return '';

    const source = notification.sourceAppPackageName?.trim().toLowerCase() ?? '';
    return `${source}|${note}|${new Date(notificationTimestamp).toISOString()}`;
  }

  private normalizeNotificationText(value: string | undefined): string {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private isProcessedNotification(notification: CardNotification): boolean {
    const notificationKey = this.getNotificationKey(notification);
    return !!notificationKey && this.processedNotificationKeys.has(notificationKey);
  }

  private isDismissedNotification(notification: CardNotification): boolean {
    const notificationKey = this.getNotificationKey(notification);
    return !!notificationKey && this.dismissedNotificationKeys.has(notificationKey);
  }

  private releaseProcessedNotificationIfPostingWasDeleted(
    notification: CardNotification
  ): boolean {
    const suffix = this.getNotificationIdentitySuffix(notification);
    if (!suffix) return false;

    const keysToRelease = [...this.processedNotificationKeys]
      .filter(key => key.endsWith(suffix));

    keysToRelease.forEach(key => this.processedNotificationKeys.delete(key));
    return keysToRelease.length > 0;
  }

  private getNotificationIdentitySuffix(
    notification: Pick<CardNotification, 'note' | 'date'> & { notificationReceivedAt?: string }
  ): string {
    const note = this.normalizeNotificationText(notification.note);
    const notificationTimestamp = this.getNotificationReceivedTimestamp(notification);

    if (!note || notificationTimestamp === null) return '';
    return `|${note}|${new Date(notificationTimestamp).toISOString()}`;
  }

  private isSameNotificationPosting(
    first: Pick<CardNotification, 'note' | 'date' | 'amount'> & { notificationReceivedAt?: string },
    second: Pick<CardNotification, 'note' | 'date' | 'amount'> & { notificationReceivedAt?: string }
  ): boolean {
    const firstTimestamp = this.getNotificationReceivedTimestamp(first);
    const secondTimestamp = this.getNotificationReceivedTimestamp(second);

    return firstTimestamp !== null && secondTimestamp !== null &&
      this.normalizeNotificationText(first.note) === this.normalizeNotificationText(second.note) &&
      Math.abs(firstTimestamp - secondTimestamp) < 60000 &&
      Math.abs((first.amount ?? 0) - (second.amount ?? 0)) < 0.01;
  }

  async restoreNotificationForDeletedCardPosting(posting: CardsPostings): Promise<void> {
    if (!posting?.note) return;

    const suffix = this.getNotificationIdentitySuffix(posting);
    if (!suffix) return;

    const sourceKey = [...this.processedNotificationKeys]
      .find(key => key.endsWith(suffix));
    const sourceAppPackageName = sourceKey?.substring(0, sourceKey.indexOf('|')) || undefined;

    this.processedNotificationKeys.forEach(key => {
      if (key.endsWith(suffix)) this.processedNotificationKeys.delete(key);
    });
    this.dismissedNotificationKeys.forEach(key => {
      if (key.endsWith(suffix)) this.dismissedNotificationKeys.delete(key);
    });

    for (let index = this.knownCardPostings.length - 1; index >= 0; index--) {
      if (this.isSameNotificationPosting(this.knownCardPostings[index], posting)) {
        this.knownCardPostings.splice(index, 1);
      }
    }

    if (!this.notifications.some(notification => this.isSameNotificationPosting(notification, posting))) {
      this.notifications.unshift({
        ...posting,
        sourceAppPackageName,
      } as CardNotification);
      this.sortNotificationsByDate();
    }

    await this.saveNotificationsToStorage();
    this.emitNotificationsCount();
    await this.loadNotifications();
  }

  async reloadNotifications(): Promise<void> {
    // Recarregar apenas republica as notificações para teste.
    // Nunca deve abrir o cadastro automaticamente.
    this.pendingNotificationHandled = false;
    this.pendingNotificationRequested = false;
    this.pendingNotificationPayload = undefined;
    localStorage.removeItem('pendingCardNotificationOpen');
    localStorage.removeItem('pendingCardNotificationPayload');

    try {
      await NotificationReader.clearPendingNotification();
    } catch (error) {
      console.warn('[DEBUG] Não foi possível limpar o clique pendente:', error);
    }

    await this.republishVisibleNotifications();
    await this.loadNotifications();
    await this.reconcileNotificationsWithCardPostings();
  }

    private async republishVisibleNotifications(): Promise<void> {
    if (this.notifications.length === 0) return;

    const payloads: NotificationPayload[] = this.notifications.map(notification => ({
      package: notification.sourceAppPackageName ?? 'com.budget.app',
      title: 'Compra detectada',
      text: notification.note ?? '',
      receivedAt: this.getNotificationReceivedTimestamp(notification) ?? Date.now(),
    }));

    try {
      await NotificationReader.repostNotifications({ notifications: payloads });
    } catch (error) {
      console.error('[DEBUG] Não foi possível republicar as notificações visíveis:', error);
    }
  }

private isDuplicate(notification: CardNotification): boolean {
    const notificationIdentity = this.getNotificationIdentitySuffix(notification);
    return !!notificationIdentity && this.notifications.some(
      item => this.getNotificationIdentitySuffix(item) === notificationIdentity
    );
  }

  private isCardPostingDuplicate(notification: CardNotification): boolean {
    const normalizedNote = this.normalizeNotificationText(notification.note);
    const notificationDate = this.getNotificationDate(notification.date);

    if (!normalizedNote || !notificationDate) return false;

    return this.knownCardPostings.some((posting) => {
      const postingDate = this.getNotificationDate(posting.date);

      return !!postingDate &&
        this.normalizeNotificationText(posting.note) === normalizedNote &&
        Math.abs(postingDate.getTime() - notificationDate.getTime()) < 60000 &&
        Math.abs((posting.amount ?? 0) - (notification.amount ?? 0)) < 0.01;
    });
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
      'BOA VISTA', 'FLORIANÓPOLIS', 'SÃO PAULO', 'ARACAJU', 'PALMAS', 'JOINVILLE'
    ];
  }

  // Gera UMA regex acento‑insensível para remover a capital se estiver no final
  private getCapitaisRegex(): RegExp {
    const patterns = this.getCapitaisBrasilBase()
      .map(c => this.toAccentInsensitivePattern(c));
    // \s+  (espaço antes), (capital) no fim, seguido de espaços/vírgula/ponto opcionais
    return new RegExp(`\\s+(?:${patterns.join('|')})\\b[\\s,.]*$`, 'i');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.initialized && changes['cardsPostings']) {
      void this.reconcileNotificationsWithCardPostings();
    }

    if (
      this.initialized &&
      changes['notificationReloadRequest'] &&
      changes['notificationReloadRequest'].currentValue !== changes['notificationReloadRequest'].previousValue
    ) {
      void this.reloadNotifications();
    }

    if (this.initialized && changes['deletedCardPosting']?.currentValue) {
      void this.restoreNotificationForDeletedCardPosting(changes['deletedCardPosting'].currentValue);
    }

    if (
      this.initialized &&
      this.pendingNotificationRequested &&
      !this.pendingNotificationHandled &&
      (changes['cardsList'] || changes['peopleList'] || changes['categoriesList'])
    ) {
      void this.tryOpenPendingNotification();
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('card-notification-route-ready', this.handlePendingNotificationRouteReady);

    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const notificationListener = this.notificationListener;

    if (notificationListener) {
      void notificationListener.remove().catch((error) => {
        console.error('[DEBUG] Não foi possível remover o listener de notificações:', error);
      });
    }
  }
}
