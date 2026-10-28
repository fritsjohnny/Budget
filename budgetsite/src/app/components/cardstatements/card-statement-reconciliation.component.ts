import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { forkJoin, Observable, of } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Cards } from 'src/app/models/cards.model';
import { CardsPostings } from 'src/app/models/cardspostings.model';
import {
  C6StatementPreview,
  C6StatementTransaction,
  CardStatementDescriptionAlias,
  CardStatementReconciliationMatch,
  CardStatementReconciliationMatchInput,
} from 'src/app/models/cardstatement.model';
import { CardsPhysicalCard } from 'src/app/models/cardsphysicalcard.model';
import { Categories } from 'src/app/models/categories.model';
import { People } from 'src/app/models/people.model';
import { CardPostingsModernDialog } from '../cardpostings/cardpostings-dialog/cardpostings-modern-dialog';
import { CardPostingsDialog } from '../cardpostings/cardpostings-dialog/cardpostings-dialog';
import { CardStatementPostingPickerDialogComponent } from './card-statement-posting-picker-dialog.component';
import { CardPostingsService } from 'src/app/services/cardpostings/cardpostings.service';
import { CardStatementsService } from 'src/app/services/cardstatements/cardstatements.service';
import { CardsInvoiceClosingService } from 'src/app/services/cardsinvoiceclosing/cardsinvoiceclosing.service';
import { Messenger } from 'src/app/common/messenger';
import { prepareApiDates } from 'src/app/utils/api-date.util';
import {
  CardStatementReconciliationDraftService,
} from 'src/app/services/cardstatements/card-statement-reconciliation-draft.service';

export interface CardStatementReconciliationDialogData {
  cardId: number;
  reference: string;
  postings: CardsPostings[];
  cardsList: Cards[];
  categoriesList: Categories[];
  peopleList: People[];
  modernLayout: boolean;
  onUpdated: () => void;
}

type ReconciliationFilter = 'all' | 'matched' | 'differences' | 'missing';
type ReconciliationStatus = 'matched' | 'ignored' | 'divergence' | 'missing' | 'budgetOnly';

interface ReconciliationRow {
  key: string;
  transaction?: C6StatementTransaction;
  transactionOccurrence?: number;
  transactionKey?: string;
  posting?: CardsPostings;
  physicalCardId?: number;
  status: ReconciliationStatus;
  amountDiff: boolean;
  descriptionDiff: boolean;
  aliasSaved: boolean;
  suggestedMatch?: boolean;
  hasAvailablePostings?: boolean;
}

@Component({
  selector: 'app-card-statement-reconciliation',
  templateUrl: './card-statement-reconciliation.component.html',
  styleUrls: [
    '../budget/budget-entry-modern-dialog.scss',
    './card-statement-reconciliation.component.scss',
  ],
})
export class CardStatementReconciliationComponent implements OnInit {
  @ViewChild('statementFileInput') statementFileInput!: ElementRef<HTMLInputElement>;

  preview?: C6StatementPreview;
  selectedFile?: File;
  physicalCards: CardsPhysicalCard[] = [];
  rows: ReconciliationRow[] = [];
  filter: ReconciliationFilter = 'all';
  importing = false;
  restoringDraft = false;
  draftRestored = false;
  draftStorageFailed = false;
  finishing = false;
  statusMessage = '';
  savingAliasKey?: string;
  savingPostingKey?: string;
  private aliases: CardStatementDescriptionAlias[] = [];
  private draftFileName?: string;
  private manualMatches: Record<string, number> = {};
  private pendingMatches: Record<string, CardStatementReconciliationMatchInput> = {};
  private pendingAliases: Record<string, { alias: CardStatementDescriptionAlias; postingId: number }> = {};
  private draftSaveQueue: Promise<void> = Promise.resolve();
  private draftZipSaved = false;
  private reconciliationMatches: CardStatementReconciliationMatch[] = [];

  constructor(
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<CardStatementReconciliationComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CardStatementReconciliationDialogData,
    private cardPostingsService: CardPostingsService,
    private cardStatementsService: CardStatementsService,
    private invoiceClosingService: CardsInvoiceClosingService,
    private messenger: Messenger,
    private draftService: CardStatementReconciliationDraftService
  ) { }

  ngOnInit(): void {
    this.restoreDraft();
  }

  get visibleRows(): ReconciliationRow[] {
    if (this.filter === 'matched') {
      return this.rows.filter(row => row.status === 'matched' || row.status === 'ignored');
    }

    if (this.filter === 'differences') {
      return this.rows.filter(row => row.status === 'divergence');
    }

    if (this.filter === 'missing') {
      return this.rows.filter(row => row.status === 'missing' || row.status === 'budgetOnly');
    }

    return this.rows;
  }

  get matchedCount(): number {
    return this.rows.filter(row => row.status === 'matched' || row.status === 'ignored').length;
  }

  get differenceCount(): number {
    return this.rows.filter(row => row.status === 'divergence').length;
  }

  get statementOnlyCount(): number {
    return this.rows.filter(row => row.status === 'missing').length;
  }

  get budgetOnlyCount(): number {
    return this.rows.filter(row => row.status === 'budgetOnly').length;
  }

  get selectedCardName(): string {
    return this.data.cardsList.find(card => card.id === this.data.cardId)?.name ?? 'Cartão';
  }

  get pendingDifference(): number {
    return this.rows.reduce((total, row) => {
      if (row.status === 'divergence' && row.transaction && row.posting) {
        return total + Math.abs(row.transaction.amountBrl - row.posting.amount);
      }

      return total;
    }, 0);
  }

  chooseFile(): void {
    this.statementFileInput.nativeElement.click();
  }

  fileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) return;
    if (!file.name.toLocaleLowerCase().endsWith('.zip')) {
      this.messenger.errorHandler('Selecione o arquivo ZIP exportado pelo C6.');
      return;
    }

    this.selectedFile = file;
    this.draftFileName = file.name;
    this.preview = undefined;
    this.rows = [];
    this.draftRestored = false;
    this.draftZipSaved = false;
    this.importing = true;
    this.statusMessage = 'Salvando o arquivo para permitir retomar a conferência...';
    this.persistDraft()
      .then(() => this.previewSelectedFile(file))
      .catch(() => {
        this.messenger.errorHandler('Não foi possível salvar o ZIP no dispositivo. A conferência continuará, mas talvez não possa ser retomada se o aplicativo fechar.');
        this.previewSelectedFile(file);
      });
  }

  private previewSelectedFile(file: File): void {
    this.importing = true;
    this.statusMessage = 'Lendo e validando o arquivo do extrato...';
    this.cardStatementsService.previewC6(file, this.data.cardId)
      .subscribe({
        next: preview => {
          this.draftFileName = preview.fileName || file.name;
          this.loadPhysicalCards(preview);
        },
        error: () => {
          this.importing = false;
          this.statusMessage = '';
        },
      });
  }

  finishReconciliation(): void {
    if (this.finishing || this.importing || this.restoringDraft || this.statusMessage) return;
    this.finishing = true;
    this.statusMessage = 'Salvando o histórico da conferência...';

    // Registra no histórico também as correspondências automáticas aceitas ao
    // concluir, mantendo as escolhas manuais e associações aprendidas no rascunho.
    this.rows.forEach(row => {
      if (row.status === 'matched' && row.transaction && row.posting) {
        this.persistReconciliationMatch(row, row.posting, true, false);
      }
    });

    const physicalCardUpdates = new Map<number, CardsPostings>();
    this.rows.forEach(row => {
      if (row.status !== 'matched' || !row.transaction || !row.posting?.id) return;

      const physicalCard = this.getPhysicalCard(row.transaction);
      if (!physicalCard?.id || row.posting.physicalCardId === physicalCard.id) return;

      physicalCardUpdates.set(row.posting.id, {
        ...row.posting,
        physicalCardId: physicalCard.id,
        physicalCard: undefined,
        physicalCardsList: undefined,
      });
    });

    if (physicalCardUpdates.size) {
      this.statusMessage = `Salvando histórico e associando ${physicalCardUpdates.size} cartão(ões) físico(s)...`;
    }

    this.draftSaveQueue.then(() => {
      const requests: Observable<unknown>[] = [];
      const reconciliationMatches = Object.values(this.pendingMatches);
      if (reconciliationMatches.length) {
        requests.push(this.cardStatementsService.saveReconciliationMatches(reconciliationMatches));
      }
      requests.push(...Object.values(this.pendingAliases).map(item => this.cardStatementsService.saveAlias(item.alias)));
      if (physicalCardUpdates.size) {
        requests.push(this.cardPostingsService.updatePhysicalCardAssociations(
          Array.from(physicalCardUpdates.entries()).map(([cardsPostingId, posting]) => ({
            cardsPostingId,
            physicalCardId: posting.physicalCardId ?? null,
          }))
        ));
      }

      const saveHistory = requests.length ? forkJoin(requests) : of([]);
      saveHistory.subscribe({
        next: () => {
          if (physicalCardUpdates.size) this.data.onUpdated();
          this.removeDraftAndClose();
        },
        error: error => {
          this.finishing = false;
          this.statusMessage = '';
          this.messenger.errorHandler(error);
        },
      });
    }).catch(error => {
      this.finishing = false;
      this.statusMessage = '';
      this.messenger.errorHandler(error);
    });
  }

  cancelReconciliation(): void {
    if (this.finishing || this.importing || this.restoringDraft || this.statusMessage) return;
    this.finishing = true;
    this.statusMessage = 'Excluindo o rascunho e as alterações pendentes...';
    this.draftSaveQueue
      .then(() => this.draftService.remove(this.data.cardId, this.data.reference))
      .then(() => this.dialogRef.close({ cancelled: true }))
      .catch(error => {
        this.finishing = false;
        this.statusMessage = '';
        this.messenger.errorHandler(error);
      });
  }

  closeKeepingDraft(): void {
    if (this.finishing || this.importing || this.restoringDraft || this.statusMessage) return;
    if (!this.selectedFile) {
      this.dialogRef.close({ draftKept: true });
      return;
    }

    this.finishing = true;
    this.statusMessage = 'Salvando o rascunho antes de fechar...';
    this.persistDraft()
      .then(() => this.dialogRef.close({ draftKept: true }))
      .catch(() => {
        this.finishing = false;
        this.statusMessage = '';
        this.messenger.errorHandler('Não foi possível salvar o rascunho. Mantenha esta tela aberta e tente novamente.');
      });
  }

  private removeDraftAndClose(): void {
    this.draftSaveQueue
      .then(() => this.draftService.remove(this.data.cardId, this.data.reference))
      .then(() => this.dialogRef.close())
      .catch(error => {
        // The history is saved; allow closing even if clearing local recovery data fails.
        this.messenger.errorHandler(error);
        this.dialogRef.close();
      });
  }

  setFilter(filter: ReconciliationFilter): void {
    this.filter = this.filter === filter ? 'all' : filter;
  }

  setIgnored(row: ReconciliationRow, isIgnored: boolean): void {
    if (!row.transaction || !row.transactionKey) return;

    const transaction = row.transaction;
    const input: CardStatementReconciliationMatchInput = {
      cardId: this.data.cardId,
      reference: this.data.reference,
      purchaseDate: transaction.purchaseDate,
      physicalCardId: row.physicalCardId ?? null,
      lastFourDigits: transaction.lastFourDigits.trim(),
      statementDescription: transaction.description,
      installment: this.normalizedInstallment(transaction.installment),
      amountBrl: transaction.amountBrl,
      occurrence: row.transactionOccurrence ?? 0,
      postingId: null,
      isResolved: false,
      isIgnored,
    };

    delete this.manualMatches[row.transactionKey];
    this.pendingMatches[row.transactionKey] = input;
    this.matchTransactions();
  }

  getPhysicalCard(transaction?: C6StatementTransaction): CardsPhysicalCard | undefined {
    if (!transaction) return undefined;

    const lastFourDigits = transaction.lastFourDigits.trim();
    const cardsWithSameNumber = this.physicalCards.filter(card =>
      card.lastFourDigits.trim() === lastFourDigits
    );
    if (cardsWithSameNumber.length === 1) return cardsWithSameNumber[0];

    const name = this.normalizeCardholder(transaction.cardholderName);
    const cardsWithSameName = cardsWithSameNumber.filter(card =>
      this.normalizeCardholder(card.nameOnCard) === name
    );
    return cardsWithSameName.length === 1 ? cardsWithSameName[0] : undefined;
  }

  saveDescriptionAssociation(row: ReconciliationRow): void {
    if (!row.transaction || !row.posting || !row.physicalCardId || this.savingAliasKey === row.key) return;

    this.persistReconciliationMatch(row, row.posting, Math.abs(row.posting.amount - row.transaction.amountBrl) < 0.005);
    this.saveDescriptionAlias(row, row.posting);
  }

  private saveDescriptionAlias(row: ReconciliationRow, posting: CardsPostings): void {
    if (!row.transaction || !row.physicalCardId || this.savingAliasKey === row.key) return;
    const alias: CardStatementDescriptionAlias = {
      cardId: this.data.cardId,
      physicalCardId: row.physicalCardId,
      statementDescription: row.transaction.description,
      budgetDescription: posting.description ?? '',
    };
    const aliasKey = `${alias.physicalCardId}|${this.normalizeDescription(alias.statementDescription)}`;
    this.pendingAliases[aliasKey] = { alias, postingId: posting.id! };
    this.aliases = this.aliases.filter(item =>
      !(item.physicalCardId === alias.physicalCardId &&
        this.normalizeDescription(item.statementDescription) === this.normalizeDescription(alias.statementDescription))
    );
    this.aliases.push(alias);
    row.aliasSaved = true;
    this.matchTransactions();
    this.persistDraft();
  }

  editPosting(row: ReconciliationRow): void {
    if (!row.posting || this.savingPostingKey) return;

    this.savingPostingKey = row.key;
    this.statusMessage = 'Verificando os dados da fatura...';
    this.invoiceClosingService.ensure(row.posting.cardId, row.posting.reference ?? this.data.reference)
      .pipe(finalize(() => this.savingPostingKey = undefined))
      .subscribe({
        next: invoiceClosing => {
          this.statusMessage = '';
          const dialogType = this.data.modernLayout ? CardPostingsModernDialog : CardPostingsDialog;
          const dialogRef = this.dialog.open(dialogType, {
            width: '100%',
            maxWidth: '100%',
            panelClass: this.data.modernLayout ? 'modern-entry-dialog-panel' : undefined,
            data: this.createPostingDialogData(row.posting!, invoiceClosing, true),
          });

          dialogRef.afterClosed().subscribe((result: CardsPostings | undefined) => {
            if (!result) return;

            if (result.deleting) {
              this.statusMessage = 'Excluindo lançamento e atualizando a conferência...';
              this.cardPostingsService.delete(result).subscribe({
                next: () => {
                  delete this.manualMatches[row.transactionKey ?? row.key];
                  Object.keys(this.pendingMatches).forEach(key => {
                    if (this.pendingMatches[key].postingId === result.id) delete this.pendingMatches[key];
                  });
                  Object.keys(this.pendingAliases).forEach(key => {
                    if (this.pendingAliases[key].postingId === result.id) delete this.pendingAliases[key];
                  });
                  this.reconciliationMatches = this.reconciliationMatches.filter(match => match.postingId !== result.id);
                  this.data.postings = this.data.postings.filter(posting => posting.id !== result.id);
                  this.persistDraft();
                  this.refreshAfterPostingChange();
                },
                error: () => this.statusMessage = '',
              });
              return;
            }

            const payload = prepareApiDates(result, ['date', 'dueDate']);
            this.statusMessage = 'Salvando alterações no lançamento...';
            this.cardPostingsService.update(payload).subscribe({
              next: () => {
                if (result.id && row.transaction) {
                  this.persistReconciliationMatch(row, result, Math.abs(result.amount - row.transaction.amountBrl) < 0.005);
                  if (Math.abs(result.amount - row.transaction.amountBrl) < 0.005 && row.physicalCardId &&
                      this.normalizeDescription(result.description) !== this.normalizeDescription(row.transaction.description)) {
                    this.saveDescriptionAlias(row, result);
                  }
                }
                this.refreshAfterPostingChange(result.id);
              },
              error: () => this.statusMessage = '',
            });
          });
        },
        error: () => this.statusMessage = '',
      });
  }

  createPosting(row: ReconciliationRow): void {
    if (!row.transaction || this.savingPostingKey) return;

    this.savingPostingKey = row.key;
    this.statusMessage = 'Preparando o lançamento para esta fatura...';
    this.invoiceClosingService.ensure(this.data.cardId, this.data.reference)
      .pipe(finalize(() => this.savingPostingKey = undefined))
      .subscribe({
        next: invoiceClosing => {
          this.statusMessage = '';
          const dialogType = this.data.modernLayout ? CardPostingsModernDialog : CardPostingsDialog;
          const dialogRef = this.dialog.open(dialogType, {
            width: '100%',
            maxWidth: '100%',
            panelClass: this.data.modernLayout ? 'modern-entry-dialog-panel' : undefined,
            data: this.createPostingDialogData(this.createPostingFromTransaction(row), invoiceClosing, false),
          });

          dialogRef.afterClosed().subscribe((result: CardsPostings | undefined) => {
            if (!result) return;

            const payload = prepareApiDates(result, ['date', 'dueDate']);
            this.statusMessage = 'Criando lançamento e vinculando ao extrato...';
            this.cardPostingsService.create(payload).subscribe({
              next: createdPosting => {
                this.data.postings.push(createdPosting);
                if (createdPosting.id) {
                  this.persistReconciliationMatch(row, createdPosting, Math.abs(createdPosting.amount - row.transaction!.amountBrl) < 0.005);
                }
                this.data.onUpdated();
                this.matchTransactions();
                this.statusMessage = '';
              },
              error: () => this.statusMessage = '',
            });
          });
        },
        error: () => this.statusMessage = '',
      });
  }

  availablePostingOptions(row: ReconciliationRow): CardsPostings[] {
    const usedPostingIds = new Set(
      this.rows
        .filter(item => item !== row && item.transaction && item.posting?.id)
        .map(item => item.posting!.id!)
    );

    return this.data.postings.filter(posting =>
      posting.id &&
      posting.amount > 0 &&
      !this.isFuturePosting(posting.date) &&
      !usedPostingIds.has(posting.id) &&
      posting.id !== row.posting?.id &&
      (!posting.physicalCardId || posting.physicalCardId === row.physicalCardId)
    ).sort((first, second) =>
      this.dateOnly(second.date).getTime() - this.dateOnly(first.date).getTime()
    );
  }

  chooseExistingPosting(row: ReconciliationRow): void {
    if (!row.transaction) return;

    const postings = this.availablePostingOptions(row);
    const isMobile = window.innerWidth <= 600;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const dialogHeight = `${Math.round(viewportHeight * (isMobile ? 0.92 : 0.82))}px`;
    const dialogRef = this.dialog.open(CardStatementPostingPickerDialogComponent, {
      width: '600px',
      maxWidth: '96vw',
      height: dialogHeight,
      maxHeight: dialogHeight,
      panelClass: 'card-statement-posting-picker-panel',
      data: {
        postings,
        statementDescription: row.transaction.description,
        statementAmount: row.transaction.amountBrl,
        statementDate: row.transaction.purchaseDate,
      },
    });

    dialogRef.afterClosed().subscribe((postingId: number | undefined) => {
      if (postingId) this.linkExistingPosting(row, postingId);
    });
  }

  linkExistingPosting(row: ReconciliationRow, postingId: number): void {
    const posting = this.data.postings.find(item => item.id === postingId);
    if (!posting || !row.transaction) return;

    this.rows = this.rows.filter(item => !(item.status === 'budgetOnly' && item.posting?.id === postingId));
    row.posting = posting;

    const alias = this.findAlias(row.transaction, row.physicalCardId);
    row.amountDiff = Math.abs(posting.amount - row.transaction.amountBrl) >= 0.005;
    const descriptionDiff = this.normalizeDescription(posting.description) !== this.normalizeDescription(row.transaction.description) &&
      (!alias || this.normalizeDescription(posting.description) !== this.normalizeDescription(alias.budgetDescription));
    row.descriptionDiff = descriptionDiff && row.amountDiff;
    row.aliasSaved = !!alias;
    row.suggestedMatch = false;
    row.status = row.amountDiff || row.descriptionDiff ? 'divergence' : 'matched';
    if (posting.id) this.persistReconciliationMatch(row, posting, !row.amountDiff);
    if (descriptionDiff && !row.amountDiff && row.physicalCardId) this.saveDescriptionAlias(row, posting);
    else this.matchTransactions();
  }

  confirmSuggestedMatch(row: ReconciliationRow): void {
    if (!row.posting?.id || !row.suggestedMatch) return;
    this.linkExistingPosting(row, row.posting.id);
  }

  statusLabel(row: ReconciliationRow): string {
    if (row.status === 'matched') return 'Conciliado';
    if (row.status === 'ignored') return 'Ignorado da conferência';
    if (row.status === 'missing') return 'Não encontrado no Budget';
    if (row.status === 'budgetOnly') return 'Sem item no extrato';
    if (row.amountDiff && row.descriptionDiff) return 'Descrição e valor diferentes';
    if (row.amountDiff) return 'Valor diferente';
    return 'Descrição diferente';
  }

  statementDate(value: string | Date): Date {
    if (value instanceof Date) return value;
    const dateOnly = String(value).slice(0, 10).split('-').map(Number);
    return dateOnly.length === 3 ? new Date(dateOnly[0], dateOnly[1] - 1, dateOnly[2]) : new Date(value);
  }

  parseInstallment(value: string): { number: number; total: number } | undefined {
    const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(value ?? '');
    return match ? { number: Number(match[1]), total: Number(match[2]) } : undefined;
  }

  private loadPhysicalCards(preview: C6StatementPreview): void {
    this.importing = true;
    this.statusMessage = 'Identificando os cartões físicos da fatura...';
    const cards = preview.physicalCards.map(card => ({
      nameOnCard: card.cardholderName,
      lastFourDigits: card.lastFourDigits,
    }));

    this.cardStatementsService.savePhysicalCards(this.data.cardId, cards).subscribe({
      next: physicalCards => {
        this.preview = preview;
        this.physicalCards = physicalCards;
        this.statusMessage = 'Carregando associações e preparando as comparações...';
        const aliasRequests = physicalCards.map(card =>
          this.cardStatementsService.readAliases(this.data.cardId, card.id!)
        );
        const aliasesRequest = aliasRequests.length
          ? forkJoin(aliasRequests)
          : of([] as CardStatementDescriptionAlias[][]);

        forkJoin({
          aliasGroups: aliasesRequest,
          matches: this.cardStatementsService.readReconciliationMatches(this.data.cardId, this.data.reference),
        }).subscribe({
          next: ({ aliasGroups, matches }) => {
            this.aliases = aliasGroups.reduce((all, group) => all.concat(group), []);
            Object.values(this.pendingAliases).forEach(item => {
              this.aliases = this.aliases.filter(alias =>
                !(alias.physicalCardId === item.alias.physicalCardId &&
                  this.normalizeDescription(alias.statementDescription) === this.normalizeDescription(item.alias.statementDescription))
              );
              this.aliases.push(item.alias);
            });
            this.reconciliationMatches = matches;
            this.matchTransactions();
            this.persistDraft();
            this.importing = false;
            this.statusMessage = '';
          },
          error: () => {
            this.importing = false;
            this.statusMessage = '';
          },
        });
      },
      error: () => {
        this.importing = false;
        this.statusMessage = '';
      },
    });
  }

  private matchTransactions(): void {
    if (!this.preview) return;

    const purchases = this.preview.transactions.filter(transaction =>
      transaction.amountBrl > 0 &&
      !this.normalizeDescription(transaction.description).startsWith('PAGAMENTOFATURA')
    ).sort((first, second) =>
      this.dateOnly(second.purchaseDate).getTime() - this.dateOnly(first.purchaseDate).getTime()
    );
    // A fatura de um cartão adicional só pode ser conciliada contra os
    // lançamentos desse cartão físico. Lançamentos ainda sem associação
    // continuam elegíveis para facilitar a migração gradual.
    const availablePostings = this.data.postings.filter(posting =>
      posting.amount > 0 &&
      !this.isFuturePosting(posting.date) &&
      (!posting.physicalCardId || this.physicalCards.some(card =>
        card.id === posting.physicalCardId && this.preview!.physicalCards.some(marker =>
          marker.lastFourDigits.trim() === card.lastFourDigits.trim() &&
          this.normalizeCardholder(card.nameOnCard) === this.normalizeCardholder(marker.cardholderName)
        )
      ))
    ).sort((first, second) =>
      this.dateOnly(second.date).getTime() - this.dateOnly(first.date).getTime()
    );
    const usedPostingIds = new Set<number>();
    const rows: ReconciliationRow[] = [];
    const occurrences = new Map<string, number>();

    purchases.forEach((transaction, index) => {
      const physicalCard = this.getPhysicalCard(transaction);
      const alias = this.findAlias(transaction, physicalCard?.id);
      const rowKey = `statement-${index}-${transaction.lastFourDigits}-${transaction.purchaseDate}`;
      const baseTransactionKey = this.transactionIdentityBase(transaction, physicalCard?.id);
      const occurrence = occurrences.get(baseTransactionKey) ?? 0;
      occurrences.set(baseTransactionKey, occurrence + 1);
      const transactionKey = `${baseTransactionKey}|${occurrence}`;
      const savedMatch = this.findReconciliationMatch(transaction, physicalCard?.id, occurrence);
      if (savedMatch?.isIgnored) {
        delete this.manualMatches[transactionKey];
        rows.push({
          key: rowKey,
          transaction,
          transactionOccurrence: occurrence,
          transactionKey,
          physicalCardId: physicalCard?.id,
          status: 'ignored',
          amountDiff: false,
          descriptionDiff: false,
          aliasSaved: !!alias,
        });
        return;
      }

      const savedPostingId = savedMatch?.postingId ?? this.manualMatches[transactionKey];
      const savedPostingCandidate = savedPostingId
        ? availablePostings.find(posting => posting.id === savedPostingId && (!posting.id || !usedPostingIds.has(posting.id)))
        : undefined;
      const savedPosting = savedPostingCandidate &&
        this.hasCompatibleDateAndInstallment(transaction, savedPostingCandidate) &&
        (!physicalCard?.id || !savedPostingCandidate.physicalCardId || savedPostingCandidate.physicalCardId === physicalCard.id)
        ? savedPostingCandidate
        : undefined;
      if (savedPostingId && !savedPosting) delete this.manualMatches[transactionKey];
      const selectedCandidate = savedPosting
        ? { posting: savedPosting, score: Number.POSITIVE_INFINITY, suggested: false, resolved: savedMatch?.isResolved === true }
        : availablePostings
        .filter(posting => !posting.id || !usedPostingIds.has(posting.id))
        .map(posting => ({
          posting,
          score: this.matchScore(transaction, posting, physicalCard, alias),
          suggested: this.isReviewableMatch(transaction, posting, physicalCard, alias),
          resolved: false,
        }))
        .filter(candidate => candidate.score >= 12 || candidate.suggested)
        // Só associa automaticamente quando há evidência forte. Correspondências
        // com descrição parcial entram como sugestão de divergência para revisão.
        .sort((a, b) => b.score - a.score)[0];
      const candidate = selectedCandidate?.posting;

      if (candidate?.id) usedPostingIds.add(candidate.id);

      const amountDiff = !!candidate && Math.abs(candidate.amount - transaction.amountBrl) >= 0.005;
      const actualDescriptionMatch = !!candidate &&
        this.normalizeDescription(candidate.description) === this.normalizeDescription(transaction.description);
      const aliasDescriptionMatch = !!candidate && !!alias &&
        this.normalizeDescription(candidate.description) === this.normalizeDescription(alias.budgetDescription);
      const rawDescriptionDiff = !!candidate && !actualDescriptionMatch && !aliasDescriptionMatch;
      const descriptionDiff = rawDescriptionDiff && !(selectedCandidate?.resolved && !amountDiff);
      const status: ReconciliationStatus = !candidate
        ? 'missing'
        : amountDiff || descriptionDiff
          ? 'divergence'
          : 'matched';

      rows.push({
        key: rowKey,
        transaction,
        transactionOccurrence: occurrence,
        transactionKey,
        posting: candidate,
        physicalCardId: physicalCard?.id,
        status,
        amountDiff,
        descriptionDiff,
        aliasSaved: !!alias,
        suggestedMatch: selectedCandidate?.suggested === true && descriptionDiff,
      });
    });

    availablePostings
      .filter(posting => posting.id && !usedPostingIds.has(posting.id))
      .forEach(posting => {
        rows.push({
          key: `budget-${posting.id}`,
          posting,
          physicalCardId: posting.physicalCardId ?? undefined,
          status: 'budgetOnly',
          amountDiff: false,
          descriptionDiff: false,
          aliasSaved: false,
        });
      });

    this.rows = rows;
    this.updateManualMatchAvailability();
    this.persistDraft();
  }

  private updateManualMatchAvailability(): void {
    this.rows.forEach(row => {
      if (!row.transaction || row.status === 'ignored') {
        row.hasAvailablePostings = false;
        return;
      }

      const usedPostingIds = new Set(
        this.rows
          .filter(item => item !== row && item.transaction && item.posting?.id)
          .map(item => item.posting!.id!)
      );
      row.hasAvailablePostings = this.data.postings.some(posting =>
        !!posting.id &&
        posting.amount > 0 &&
        !this.isFuturePosting(posting.date) &&
        !usedPostingIds.has(posting.id) &&
        posting.id !== row.posting?.id &&
        (!posting.physicalCardId || posting.physicalCardId === row.physicalCardId)
      );
    });
  }

  private restoreDraft(): void {
    this.restoringDraft = true;
    this.statusMessage = 'Verificando se existe uma conferência salva neste dispositivo...';
    this.draftService.load(this.data.cardId, this.data.reference)
      .then(draft => {
        if (!draft || draft.cardId !== this.data.cardId || draft.reference !== this.data.reference) return;

        const zipContent = draft.zipBytes ?? draft.zipBlob;
        if (!zipContent) {
          this.draftStorageFailed = true;
          return;
        }

        this.selectedFile = new File([zipContent], draft.fileName, { type: 'application/zip' });
        this.draftZipSaved = !!draft.zipBytes;
        this.draftFileName = draft.fileName;
        this.manualMatches = { ...(draft.manualMatches ?? {}) };
        this.pendingMatches = { ...(draft.pendingMatches ?? {}) };
        this.pendingAliases = { ...(draft.pendingAliases ?? {}) };
        this.draftRestored = true;

        if (draft.preview) {
          this.loadPhysicalCards(draft.preview);
        } else if (this.selectedFile) {
          this.previewSelectedFile(this.selectedFile);
        }
      })
      .catch(() => this.draftStorageFailed = true)
      .finally(() => {
        this.restoringDraft = false;
        if (this.statusMessage === 'Verificando se existe uma conferência salva neste dispositivo...') {
          this.statusMessage = '';
        }
      });
  }

  private persistDraft(): Promise<void> {
    if (!this.selectedFile || !this.draftFileName) return Promise.resolve();

    const draft = {
      cardId: this.data.cardId,
      reference: this.data.reference,
      fileName: this.draftFileName,
      zipBlob: this.selectedFile,
      preview: this.preview,
      manualMatches: { ...this.manualMatches },
      pendingMatches: { ...this.pendingMatches },
      pendingAliases: { ...this.pendingAliases },
      savedAt: new Date().toISOString(),
    };
    const saveRequest = this.draftSaveQueue
      .catch(() => undefined)
      .then(() => this.draftService.save(draft, !this.draftZipSaved))
      .then(() => {
        this.draftZipSaved = true;
        this.draftStorageFailed = false;
      });
    this.draftSaveQueue = saveRequest.catch(() => {
      this.draftStorageFailed = true;
    });
    return saveRequest;
  }

  private persistReconciliationMatch(
    row: ReconciliationRow,
    posting: CardsPostings,
    isResolved: boolean,
    saveDraft = true
  ): void {
    if (!row.transaction || !posting.id) return;

    const transactionKey = row.transactionKey ??
      `${this.transactionIdentityBase(row.transaction, row.physicalCardId)}|${row.transactionOccurrence ?? 0}`;
    this.manualMatches[transactionKey] = posting.id;

    const input: CardStatementReconciliationMatchInput = {
      cardId: this.data.cardId,
      reference: this.data.reference,
      purchaseDate: row.transaction.purchaseDate,
      physicalCardId: row.physicalCardId ?? null,
      lastFourDigits: row.transaction.lastFourDigits.trim(),
      statementDescription: row.transaction.description,
      installment: this.normalizedInstallment(row.transaction.installment),
      amountBrl: row.transaction.amountBrl,
      occurrence: row.transactionOccurrence ?? 0,
      postingId: posting.id,
      isResolved,
      isIgnored: false,
    };
    this.pendingMatches[transactionKey] = input;
    const pendingMatch: CardStatementReconciliationMatch = {
      cardId: input.cardId,
      reference: input.reference,
      purchaseDate: input.purchaseDate,
      physicalCardId: input.physicalCardId,
      lastFourDigits: input.lastFourDigits,
      normalizedStatementDescription: this.normalizeDescription(input.statementDescription),
      installment: input.installment,
      amountBrl: input.amountBrl,
      occurrence: input.occurrence,
      postingId: input.postingId,
      isResolved: input.isResolved,
      isIgnored: input.isIgnored,
    };
    const existingIndex = this.reconciliationMatches.findIndex(match =>
      this.sameReconciliationTransaction(match, row.transaction!, row.physicalCardId, row.transactionOccurrence ?? 0)
    );
    if (existingIndex >= 0) this.reconciliationMatches[existingIndex] = pendingMatch;
    else this.reconciliationMatches.push(pendingMatch);
    if (saveDraft) this.persistDraft();
  }

  private findReconciliationMatch(
    transaction: C6StatementTransaction,
    physicalCardId: number | undefined,
    occurrence: number
  ): CardStatementReconciliationMatch | undefined {
    const pendingMatch = Object.values(this.pendingMatches)
      .map(input => this.toReconciliationMatch(input))
      .find(match => this.sameReconciliationTransaction(match, transaction, physicalCardId, occurrence));
    if (pendingMatch) return pendingMatch;

    return this.reconciliationMatches.find(match =>
      this.sameReconciliationTransaction(match, transaction, physicalCardId, occurrence)
    );
  }

  private toReconciliationMatch(input: CardStatementReconciliationMatchInput): CardStatementReconciliationMatch {
    return {
      cardId: input.cardId,
      reference: input.reference,
      purchaseDate: input.purchaseDate,
      physicalCardId: input.physicalCardId,
      lastFourDigits: input.lastFourDigits,
      normalizedStatementDescription: this.normalizeDescription(input.statementDescription),
      installment: input.installment,
      amountBrl: input.amountBrl,
      occurrence: input.occurrence,
      postingId: input.postingId,
      isResolved: input.isResolved,
      isIgnored: input.isIgnored,
    };
  }

  private sameReconciliationTransaction(
    match: CardStatementReconciliationMatch,
    transaction: C6StatementTransaction,
    physicalCardId: number | undefined,
    occurrence: number
  ): boolean {
    return this.dateOnly(match.purchaseDate).getTime() === this.dateOnly(transaction.purchaseDate).getTime() &&
      (match.physicalCardId ?? undefined) === physicalCardId &&
      match.lastFourDigits.trim() === transaction.lastFourDigits.trim() &&
      match.normalizedStatementDescription === this.normalizeDescription(transaction.description) &&
      match.installment === this.normalizedInstallment(transaction.installment) &&
      Math.round(match.amountBrl * 100) === Math.round(transaction.amountBrl * 100) &&
      match.occurrence === occurrence;
  }

  private transactionIdentityBase(transaction: C6StatementTransaction, physicalCardId?: number): string {
    const date = this.dateOnly(transaction.purchaseDate);
    const dateKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return [
      dateKey,
      physicalCardId ?? '',
      transaction.lastFourDigits.trim(),
      this.normalizeDescription(transaction.description),
      this.normalizedInstallment(transaction.installment),
      Math.round(transaction.amountBrl * 100),
    ].join('|');
  }

  private normalizedInstallment(value: string): string {
    const installment = this.parseInstallment(value);
    return installment
      ? `${installment.number}/${installment.total}`
      : (value ?? '').replace(/\s+/g, '').toUpperCase();
  }

  private findAlias(transaction: C6StatementTransaction, physicalCardId?: number): CardStatementDescriptionAlias | undefined {
    if (!physicalCardId) return undefined;

    const normalizedDescription = this.normalizeDescription(transaction.description);
    return this.aliases.find(alias =>
      alias.physicalCardId === physicalCardId &&
      this.normalizeDescription(alias.statementDescription) === normalizedDescription
    );
  }

  private matchScore(
    transaction: C6StatementTransaction,
    posting: CardsPostings,
    physicalCard: CardsPhysicalCard | undefined,
    alias: CardStatementDescriptionAlias | undefined
  ): number {
    if (posting.physicalCardId && physicalCard?.id && posting.physicalCardId !== physicalCard.id) return -100;
    if (!this.hasCompatibleDateAndInstallment(transaction, posting)) return -100;

    const postingDescription = this.normalizeDescription(posting.description);
    const expectedDescription = this.normalizeDescription(alias?.budgetDescription ?? transaction.description);
    const descriptionSimilarity = this.tokenSimilarity(expectedDescription, postingDescription);
    const exactDescription = expectedDescription === postingDescription;
    if (!exactDescription && descriptionSimilarity < 0.25) return -100;

    let score = exactDescription ? 12 : descriptionSimilarity * 8;
    if (physicalCard?.id && posting.physicalCardId === physicalCard.id) score += 5;
    if (Math.abs(posting.amount - transaction.amountBrl) < 0.005) score += 4;

    const dateDifference = Math.abs(this.dayDifference(posting.date, transaction.purchaseDate));
    if (dateDifference === 0) score += 4;
    else if (dateDifference <= 7) score += 3;
    else if (dateDifference <= 31) score += 1;
    else score -= 4;

    const installment = this.parseInstallment(transaction.installment);
    if (installment && posting.parcels === installment.total) {
      if (posting.parcelNumber === installment.number) score += 5;
      else score -= 6;
    } else if (!installment && (posting.parcels ?? 1) <= 1) {
      score += 2;
    }

    return score;
  }

  private isReviewableMatch(
    transaction: C6StatementTransaction,
    posting: CardsPostings,
    physicalCard: CardsPhysicalCard | undefined,
    alias: CardStatementDescriptionAlias | undefined
  ): boolean {
    if (posting.physicalCardId && physicalCard?.id && posting.physicalCardId !== physicalCard.id) return false;
    if (!this.hasCompatibleDateAndInstallment(transaction, posting)) return false;
    if (Math.abs(posting.amount - transaction.amountBrl) >= 0.005) return false;

    const expectedDescription = this.normalizeWords(alias?.budgetDescription ?? transaction.description);
    const postingDescription = this.normalizeWords(posting.description);
    const descriptionSimilarity = this.tokenSimilarity(expectedDescription, postingDescription);
    return descriptionSimilarity >= 0.3;
  }

  private hasCompatibleDateAndInstallment(transaction: C6StatementTransaction, posting: CardsPostings): boolean {
    // A diferença de até um dia cobre eventuais ajustes entre a data do extrato
    // e a data salva no Budget. Lançamentos mais distantes não devem ser sugeridos.
    if (Math.abs(this.dayDifference(posting.date, transaction.purchaseDate)) > 1) return false;

    const installment = this.parseInstallment(transaction.installment);
    if (installment) {
      return posting.parcels === installment.total && posting.parcelNumber === installment.number;
    }

    // Se o extrato não indica parcela, trata-se de compra à vista.
    return (posting.parcels ?? 1) <= 1;
  }

  private dayDifference(postingDate: string | Date, statementDate: string | Date): number {
    const posting = this.dateOnly(postingDate);
    const statement = this.dateOnly(statementDate);
    return Math.round((posting.getTime() - statement.getTime()) / 86400000);
  }

  private isFuturePosting(value: string | Date): boolean {
    const postingDate = this.dateOnly(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return postingDate.getTime() > today.getTime();
  }

  private dateOnly(value: string | Date): Date {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const parsed = new Date(value);
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  private normalizeCardholder(value: string): string {
    return this.normalizeDescription(value).replace(/[^A-Z0-9]/g, '');
  }

  private normalizeDescription(value?: string): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
  }

  private normalizeWords(value?: string): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();
  }

  private tokenSimilarity(first: string, second: string): number {
    const ignored = new Set(['LTDA', 'ME', 'EPP', 'LOJA', 'COMERCIO', 'COM', 'BR']);
    const tokensA = new Set((this.normalizeWords(first).match(/[A-Z0-9]{3,}/g) ?? []).filter(token => !ignored.has(token)));
    const tokensB = new Set((this.normalizeWords(second).match(/[A-Z0-9]{3,}/g) ?? []).filter(token => !ignored.has(token)));
    if (!tokensA.size || !tokensB.size) return 0;

    const shared = [...tokensA].filter(token => tokensB.has(token)).length;
    return shared / new Set([...tokensA, ...tokensB]).size;
  }

  private createPostingFromTransaction(row: ReconciliationRow): CardsPostings {
    const transaction = row.transaction!;
    const installment = this.parseInstallment(transaction.installment);

    return {
      cardId: this.data.cardId,
      physicalCardId: row.physicalCardId,
      description: transaction.description,
      reference: this.data.reference,
      date: this.statementDate(transaction.purchaseDate),
      amount: transaction.amountBrl,
      totalAmount: transaction.amountBrl * (installment?.total ?? 1),
      parcelNumber: installment?.number ?? 1,
      parcels: installment?.total ?? 1,
      others: false,
      category: '',
      generateParcels: false,
      repeatParcels: false,
      peopleList: this.data.peopleList,
      categoriesList: this.data.categoriesList,
      cardsList: this.data.cardsList,
      physicalCardsList: this.physicalCards,
      adding: true,
      editing: false,
      provisioned: false,
      repeatToNextMonths: false,
      preserveFutureValues: false,
    };
  }

  private createPostingDialogData(
    posting: CardsPostings,
    invoiceClosing: any,
    editing: boolean
  ): CardsPostings {
    return {
      ...posting,
      peopleList: this.data.peopleList,
      categoriesList: this.data.categoriesList,
      cardsList: this.data.cardsList,
      physicalCardsList: this.physicalCards,
      expensesList: [],
      editing,
      adding: !editing,
      deleting: false,
      invoiceClosing,
      sourceInvoiceClosing: editing ? invoiceClosing : undefined,
      allowClosedInvoiceOperation: false,
      provisioned: posting.provisioned ?? false,
      generateParcels: false,
      repeatParcels: false,
      repeatToNextMonths: false,
      preserveFutureValues: false,
      monthsToRepeat: 12,
    };
  }

  private refreshAfterPostingChange(postingId?: number): void {
    if (!postingId) {
      this.data.onUpdated();
      this.matchTransactions();
      this.statusMessage = '';
      return;
    }

    this.statusMessage = 'Atualizando a conferência...';
    this.cardPostingsService.readById(postingId).subscribe({
      next: posting => {
        const index = this.data.postings.findIndex(item => item.id === postingId);
        if (index >= 0) this.data.postings[index] = posting;
        this.data.onUpdated();
        this.matchTransactions();
        this.statusMessage = '';
      },
      error: () => {
        this.data.onUpdated();
        this.statusMessage = '';
      },
    });
  }
}
