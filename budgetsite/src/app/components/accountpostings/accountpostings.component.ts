import {
  Component,
  OnInit,
  Input,
  SimpleChanges,
  AfterViewInit,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  Output,
  EventEmitter,
} from '@angular/core';
import { AccountsPostings } from '../../models/accountspostings.model';
import { AccountService } from 'src/app/services/account/account.service';
import { AccountPostingsService } from '../../services/accountpostings/accountpostings.service';
import {
  MatDialog,
} from '@angular/material/dialog';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Accounts } from 'src/app/models/accounts.model';
import { Incomes } from 'src/app/models/incomes.model';
import { Expenses } from 'src/app/models/expenses.model';
import { IncomeService } from 'src/app/services/income/income.service';
import { ExpenseService } from 'src/app/services/expense/expense.service';
import { MatTableDataSource } from '@angular/material/table';
import { AccountPostingsDialog } from './accountpostings-dialog/accountpostings-dialog';
import { AccountPostingsModernDialog } from './accountpostings-dialog/accountpostings-modern-dialog';
import { YieldsComponent } from '../yields/yields.component';
import { AccountsApplications } from 'src/app/models/accountsapplications.model';
import { AccountApplicationsService } from 'src/app/services/accountapplications/accountapplications.service';
import { AccountApplicationsDialog } from './accountapplications-dialog/accountapplications-dialog';
import { AccountApplicationsModernDialog } from './accountapplications-dialog/accountapplications-modern-dialog';
import { GenerateCardReceiptDialog } from './generate-cardreceipt-dialog/generate-cardreceipt-dialog';
import { Messenger } from 'src/app/common/messenger';
import { prepareApiDates } from 'src/app/utils/api-date.util';

@Component({
  selector: 'app-accountpostings',
  templateUrl: './accountpostings.component.html',
  styleUrls: ['./accountpostings.component.scss'],
})
export class AccountPostingsComponent implements OnInit, AfterViewInit {
  @Input() modernLayout: boolean = false;

  get modernLayoutContext(): AccountPostingsComponent {
    return this;
  }

  private get accountEntryDialogPanelClass(): string | undefined {
    return this.modernLayout ? 'modern-account-entry-dialog-panel' : undefined;
  }

  private get accountAuxDialogPanelClass(): string | undefined {
    return this.modernLayout ? 'modern-account-dialog-panel' : undefined;
  }

  private get accountPostingsDialogComponent(): any {
    return this.modernLayout ? AccountPostingsModernDialog : AccountPostingsDialog;
  }

  private get accountApplicationsDialogComponent(): any {
    return this.modernLayout ? AccountApplicationsModernDialog : AccountApplicationsDialog;
  }

  @Input() accountId?: number;
  @Input() reference?: string;

  @Output() accountUpdated = new EventEmitter<Partial<Accounts>>();

  private _accountsList: Accounts[] = [];
  @Input() set accountsList(value: Accounts[] | undefined) {
    this._accountsList = value ?? [];
    this.rebindAccount();                // 🔑 reamarrar toda vez que a lista muda
  }
  get accountsList(): Accounts[] {
    return this._accountsList;
  }

  account: Accounts | null = null;

  @ViewChild('input') filterInput!: ElementRef;

  accountpostings!: AccountsPostings[];
  accountApplications!: AccountsApplications[];
  incomes!: Incomes[];
  expenses!: Expenses[];
  displayedColumns = [
    'index',
    'date',
    'description',
    'amount',
    'runningAmount',
    // 'actions',
  ];
  accountApplicationsDisplayedColumns = [
    'indexApplication',
    'dateApplication',
    'amountApplication',
    'maximumApplication',
    'availableApplication',
    'cdiApplication',
    'dueDateApplication',
  ];
  total: number = 0;
  totalApplications: number = 0;
  grandTotalBalance?: number = 0;
  grandTotalYields?: number = 0;
  totalBalance?: number = 0;
  currentBalance?: number = 0;
  currentGrossBalance?: number = 0;
  totalGrossBalance?: number = 0;
  previousBalance?: number = 0;
  totalYields?: number = 0;
  totalForYieldsDialog?: number = 0;
  hideProgress: boolean = true;
  loadingMessage: string = 'Carregando lançamentos...';
  maxBalance: number = 0;
  minBalance: number = 0;
  accountPostingsLength: number = 0;

  get totalEntries(): number {
    return (this.accountpostings ?? []).filter(posting => posting.amount > 0).reduce((total, posting) => total + posting.amount, 0);
  }

  get totalExits(): number {
    return (this.accountpostings ?? []).filter(posting => posting.amount < 0).reduce((total, posting) => total + Math.abs(posting.amount), 0);
  }

  get postingsBalance(): number {
    return this.totalEntries - this.totalExits;
  }

  filterOpend: boolean = false;
  dataSource = new MatTableDataSource(this.accountpostings);
  accountApplicationsDataSource = new MatTableDataSource(this.accountApplications);

  readonly IOF_DAYS_STORAGE_KEY = 'budget.iofElapsedDays';
  readonly IOF_DATE_STORAGE_KEY = 'budget.iofElapsedDate';

  accountPostingsPanelExpanded: boolean = false;
  accountApplicationsPanelExpanded: boolean = false;

  lastYield: number = 0;
  totalPreviousYield: number = 0;
  private pendingAccountPostingFocusId?: number;
  focusedAccountPostingId?: number;

  constructor(
    private accountPostingsService: AccountPostingsService,
    private accountApplicationsService: AccountApplicationsService,
    private accountService: AccountService,
    private incomeService: IncomeService,
    private expenseService: ExpenseService,
    public dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private elementRef: ElementRef,
    private messenger: Messenger
  ) { }

  ngOnInit(): void {
    this.accountPostingsPanelExpanded =
      localStorage.getItem('accountPostingsPanelExpanded') === 'true';

    this.accountApplicationsPanelExpanded =
      localStorage.getItem('accountApplicationsPanelExpanded') === 'true';
  }

  ngAfterViewInit(): void {
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accountId']?.currentValue || changes['reference']?.currentValue)
      this.refresh();
  }

  accountPostingsPanelClosed() {
    localStorage.setItem('accountPostingsPanelExpanded', 'false');
  }

  accountPostingsPanelOpened() {
    localStorage.setItem('accountPostingsPanelExpanded', 'true');
  }

  accountApplicationsPanelClosed() {
    localStorage.setItem('accountApplicationsPanelExpanded', 'false');
  }

  accountApplicationsPanelOpened() {
    localStorage.setItem('accountApplicationsPanelExpanded', 'true');
  }

  private rebindAccount(): void {
    const previousAccountId = this.account?.id;
    const previousCurrentGrossBalance = this.currentGrossBalance;

    this.account = this._accountsList?.find(a => a.id === this.accountId) ?? null;

    if (this.account?.totalBalanceGross !== undefined) {
      const updatedCurrentGrossBalance = Number(this.account.totalBalanceGross);

      if (previousAccountId === this.account.id && previousCurrentGrossBalance !== undefined) {
        const grossBalanceDifference = updatedCurrentGrossBalance - previousCurrentGrossBalance;
        this.totalGrossBalance = Number(this.totalGrossBalance ?? 0) + grossBalanceDifference;
      } else {
        this.totalGrossBalance = updatedCurrentGrossBalance;
      }

      this.currentGrossBalance = updatedCurrentGrossBalance;
    }

    this.cdr.markForCheck();
  }

  getLists() {
    this.getAccountsList();

    this.incomeService.readComboList(this.reference!).subscribe({
      next: (incomes) => {
        this.incomes = incomes;

        this.hideProgress = true;
      },
      error: () => (this.hideProgress = true),
    });

    this.expenseService.readComboList(this.reference!).subscribe({
      next: (expenses) => {
        this.expenses = expenses;

        this.hideProgress = true;
      },
      error: () => (this.hideProgress = true),
    });
  }

  getAccountsList() {
    this.accountService.readNotDisabled().subscribe({
      next: (accounts) => {
        this.accountsList = accounts;

        this.account = this.accountsList?.find((a) => a.id === this.accountId)!;

        this.hideProgress = true;
      },
      error: () => (this.hideProgress = true),
    });
  }

  getPreviousYield() {
    if (!this.accountId || !this.reference) {
      this.lastYield = 0;
      this.refreshAccountsList(this.lastYield);
      return;
    }

    this.accountPostingsService.getPreviousYield(this.accountId, this.reference).subscribe({
      next: (previousYield) => {
        this.lastYield = previousYield ?? 0;
        this.refreshAccountsList(this.lastYield);
      },
      error: () => {
        this.lastYield = 0;
        this.refreshAccountsList(this.lastYield);
      },
    });
  }

  getTotalPreviousYield() {
    if (!this.accountId || !this.reference) {
      this.totalPreviousYield = 0;
      return;
    }

    this.accountPostingsService.getTotalPreviousYields(this.accountId, this.reference).subscribe({
      next: (totalLastYield) => {
        this.totalPreviousYield = totalLastYield ?? 0;
      },
      error: () => {
        this.totalPreviousYield = 0;
      },
    });
  }

  refresh() {
    this.getLists();

    if (this.accountId) {
      this.hideProgress = false;

      this.getPreviousYield();
      this.getTotalPreviousYield();

      this.accountPostingsService
        .read(this.accountId!, this.reference!)
        .subscribe({
          next: (accountpostings) => {
            this.accountpostings = accountpostings;

            this.accountPostingsLength = this.accountpostings.length;

            this.dataSource = new MatTableDataSource(this.accountpostings);

            this.getTotalAmount();
            this.getAccountTotals();
          },
          error: () => (this.hideProgress = true),
        });

      this.accountApplicationsService
        .readByAccount(this.accountId!)
        .subscribe({
          next: (accountApplications) => {
            this.accountApplications = accountApplications;

            // this.accountApplicationsLength = this.accountApplications.length;

            this.accountApplicationsDataSource = new MatTableDataSource(this.accountApplications);

            this.getTotalApplications();
          },
          error: () => (this.hideProgress = true),
        });
    }
  }

  getPreviousReference(reference: string): string {
    const year = Number(reference.substring(0, 4));
    const month = Number(reference.substring(4, 6)); // 1–12

    const date = new Date(year, month - 1, 1);
    date.setMonth(date.getMonth() - 1);

    const prevYear = date.getFullYear();
    const prevMonth = (date.getMonth() + 1).toString().padStart(2, '0');

    return `${prevYear}${prevMonth}`;
  }

  getAccountTotals() {
    this.accountService
      .getAccountTotals(this.accountId, this.reference)
      .subscribe({
        next: (account) => {
          this.grandTotalBalance = account.grandTotalBalance;
          this.grandTotalYields = account.grandTotalYields;
          this.totalBalance = account.totalBalance;
          this.currentBalance = account.currentBalance;
          this.currentGrossBalance = account.currentGrossBalance;
          this.totalGrossBalance = account.totalBalanceGross;
          this.refreshAccountsList(undefined, account.currentGrossBalance);
          this.previousBalance = account.previousBalance;
          this.totalYields = this.totalForYieldsDialog = account.totalYields;

          if (!this.totalForYieldsDialog) {
            this.accountService
              .getAccountTotals(this.accountId, this.getPreviousReference(this.reference!))
              .subscribe({
                next: (account) => {
                  this.totalForYieldsDialog = account.totalYields;
                },
              });
          }

          let runningValue = this.previousBalance ?? 0;

          this.minBalance = runningValue;
          this.maxBalance = 0;

          this.accountpostings
            .sort((a, b) => a.position! - b.position!)
            .forEach((accountposting) => {
              accountposting.runningAmount = runningValue +=
                accountposting.amount;

              this.minBalance =
                accountposting.runningAmount < this.minBalance
                  ? accountposting.runningAmount
                  : this.minBalance;

              this.maxBalance =
                accountposting.runningAmount > this.maxBalance
                  ? accountposting.runningAmount
                  : this.maxBalance;
            });

          this.accountpostings = [
            ...this.accountpostings.sort((a, b) => b.position! - a.position!),
          ];

          this.dataSource = new MatTableDataSource(this.accountpostings);

          this.hideProgress = true;
          this.focusPendingAccountPosting();
        },
        error: () => (this.hideProgress = true),
      });
  }

  isTransferPosting(posting: AccountsPostings): boolean {
    return posting.type !== 'Y'
      && (posting.type === 'P' || posting.type === 'R')
      && posting.relatedId != null
      && posting.toAccountId != null;
  }

  getTotalAmount() {
    this.total = this.accountpostings
      ? this.accountpostings
        .map((t) => t.amount)
        .reduce((acc, value) => acc + value, 0)
      : 0;
  }

  getTotalApplications() {
    this.totalApplications = this.accountApplications
      ? this.accountApplications
        .map((t) => t.amountApplied)
        .reduce((acc, value) => acc + value, 0)
      : 0;
  }

  get applicationsCapacitySummary() {
    const active = (this.accountApplications ?? []).filter(a => !a.disabled);
    const limits = [...new Set(active.map(a => a.maximumAmount).filter((v): v is number => v !== null && Number.isFinite(v)))];
    const conditions = [...new Set(active.map(a => `${a.cdiPercent === null || a.cdiPercent === undefined ? '' : (a.cdiPercent > 2 ? a.cdiPercent : a.cdiPercent * 100).toFixed(6)}|${a.fixedRate ?? ''}`))];
    const conflict = limits.length > 1 || conditions.length > 1;
    const maximum = limits.length === 1 ? limits[0] : null;
    const occupied = active.reduce((sum, a) => sum + (Number(a.amountApplied) || 0), 0);
    return { maximum, occupied, available: !conflict && maximum !== null ? Math.max(0, maximum - occupied) : null, conflict };
  }

  applicationMaximumLabel(row: AccountsApplications): string {
    return row.maximumAmount === null || !Number.isFinite(row.maximumAmount) ? 'Não informado' : row.maximumAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  applicationAvailableLabel(): string {
    const summary = this.applicationsCapacitySummary;
    if (summary.conflict) return 'Verificar cadastro';
    if (summary.available === null) return 'Não calculável';
    return summary.available.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  applicationRateLabel(row: AccountsApplications): string {
    const cdi = row.cdiPercent === null || row.cdiPercent === undefined ? '' : `${(row.cdiPercent > 2 ? row.cdiPercent : row.cdiPercent * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% CDI`;
    const fixed = row.fixedRate ? `${row.fixedRate.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% a.a.` : '';
    return [cdi, fixed].filter(Boolean).join(' · ') || 'Não informado';
  }

  getFilteredTotalAmount() {
    this.total = this.dataSource.filteredData
      ? Array(this.dataSource.filteredData)[0]
        .map((t) => t.amount)
        .reduce((acc, value) => acc + value, 0)
      : 0;
  }

  getLastYield() {
    this.refreshAccountsList(this.lastYield);

    return this.lastYield;
  }

  refreshAccountsList(lastYield?: number, totalBalanceGross?: number) {
    if (!this.accountId) return;

    const patch: Partial<Accounts> = { id: this.accountId };
    if (lastYield !== undefined) patch.lastYield = lastYield;
    if (totalBalanceGross !== undefined) patch.totalBalanceGross = totalBalanceGross;

    const account = this.accountsList?.find((a) => a.id === this.accountId);

    if (account) {
      if (lastYield !== undefined) {
        account.lastYield = lastYield;
      }

      if (totalBalanceGross !== undefined) {
        account.totalBalanceGross = totalBalanceGross;
      }

      this.accountsList = [...this.accountsList];
    }

    if (lastYield !== undefined || totalBalanceGross !== undefined) {
      this.accountUpdated.emit(patch);
    }
  }

  add() {
    const dialogRef = this.dialog.open(this.accountPostingsDialogComponent, {
      width: '100%',
      maxWidth: '100%',
      panelClass: this.accountEntryDialogPanelClass,
      data: {
        reference: this.reference,
        accountId: this.accountId,
        editing: false,
        type: 'Y',
        accountsList: this.accountsList,
        incomesList: this.incomes,
        expensesList: this.expenses,
        totalBalance: this.totalBalance,
        currentBalanceForYield: this.currentBalance,
        currentGrossBalanceForYield: this.currentGrossBalance,
        totalGrossBalance: this.totalGrossBalance,
        totalYields: this.totalForYieldsDialog,
        lastYield: this.getLastYield(),
        totalPreviousYield: this.totalPreviousYield,
        accountPostingsYields: this.accountpostings.filter(t => t.type === 'Y'),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // this.hideProgress = false;

        result.amount = result.amount * (result.type === 'P' ? -1 : 1);

        result.position = this.accountpostings.length + 1;

        const payload = prepareApiDates(result, ['date', 'iofElapsedDate']);
        this.accountPostingsService.create(payload).subscribe({
          next: (accountpostings) => {
            if (
              accountpostings.reference === this.reference &&
              accountpostings.accountId === this.accountId
            ) {
              this.prepareAccountPostingFocus(accountpostings.id);
              this.refresh();

              return;
            }

            this.getTotalAmount();
            this.getAccountTotals();
            this.getAccountsList();
          },
          // error: () => this.hideProgress = true
        });
      }
    });
  }

  private prepareAccountPostingFocus(postingId?: number): void {
    if (!this.modernLayout || !postingId) return;

    this.pendingAccountPostingFocusId = postingId;
    this.focusedAccountPostingId = postingId;
    this.accountPostingsPanelExpanded = true;
    localStorage.setItem('accountPostingsPanelExpanded', 'true');
  }

  private focusPendingAccountPosting(): void {
    const postingId = this.pendingAccountPostingFocusId;
    if (!this.modernLayout || !postingId) return;

    this.focusedAccountPostingId = postingId;

    setTimeout(() => {
      const rows = Array.from(
        this.elementRef.nativeElement.querySelectorAll(
          `[data-account-posting-id="${postingId}"]`
        )
      ) as HTMLElement[];
      const row = rows.find(element => element.getClientRects().length > 0) ?? null;

      if (!row) {
        this.clearAccountPostingFocus(postingId);
        return;
      }

      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.focus({ preventScroll: true });
      this.pendingAccountPostingFocusId = undefined;

      setTimeout(() => this.clearAccountPostingFocus(postingId), 2500);
    });
  }

  private clearAccountPostingFocus(postingId: number): void {
    if (this.pendingAccountPostingFocusId === postingId) {
      this.pendingAccountPostingFocusId = undefined;
    }

    if (this.focusedAccountPostingId === postingId) {
      this.focusedAccountPostingId = undefined;
      this.cdr.detectChanges();
    }
  }

  editOrDelete(accountPosting: AccountsPostings, event: any) {
    if (event != null && event.target.textContent === 'more_vert') {
      return;
    }

    const dialogRef = this.dialog.open(this.accountPostingsDialogComponent, {
      width: '100%',
      maxWidth: '100%',
      panelClass: this.accountEntryDialogPanelClass,
      data: {
        id: accountPosting.id,
        accountId: accountPosting.accountId,
        date: accountPosting.date,
        reference: accountPosting.reference,
        position: accountPosting.position,
        description: accountPosting.description,
        amount: accountPosting.amount,
        grossAmount: accountPosting.grossAmount,
        originalAmount: accountPosting.amount,
        originalGrossAmount: accountPosting.grossAmount,
        note: accountPosting.note,
        editing: true,
        accountsList: this.accountsList,
        deleting: false,
        type: accountPosting.type,
        cardReceiptId: accountPosting.cardReceiptId,
        expenseId: accountPosting.expenseId,
        incomeId: accountPosting.incomeId,
        incomesList: this.incomes,
        expensesList: this.expenses,
        totalBalance: this.totalBalance,
        currentBalanceForYield: this.currentBalance,
        currentGrossBalanceForYield: this.currentGrossBalance,
        totalGrossBalance: accountPosting.type === 'Y'
          ? (accountPosting.totalGrossBalance ?? this.totalGrossBalance)
          : this.totalGrossBalance,
        totalIOF: accountPosting.totalIOF,
        totalIR: accountPosting.totalIR,
        iofElapsedDays: accountPosting.iofElapsedDays,
        totalYields: this.totalForYieldsDialog,
        lastYield: this.getLastYield(),
        totalPreviousYield: this.totalPreviousYield,
        accountPostingsYields: this.accountpostings.filter(t => t.type === 'Y'),
        relatedId: accountPosting.relatedId,
        toAccountId: accountPosting.toAccountId,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        //this.hideProgress = false;

        if (result.deleting) {
          this.accountPostingsService.delete(result.id).subscribe({
            next: () => {
              this.accountpostings = this.accountpostings.filter(
                (t) => t.id! != result.id!
              );

              this.dataSource = new MatTableDataSource(this.accountpostings);

              this.getTotalAmount();
              this.getAccountTotals();
              this.getAccountsList();
            },
            // error: () => this.hideProgress = true
          });
        } else {
          result.amount =
            Math.abs(result.amount) * (result.type === 'P' ? -1 : 1);

          const payload = prepareApiDates(result, ['date', 'iofElapsedDate']);
          this.accountPostingsService.update(payload).subscribe({
            next: () => {
              this.accountpostings
                .filter((t) => t.id === result.id)
                .map((t) => {
                  t.date = result.date;
                  t.accountId = result.accountId;
                  t.incomeId = result.incomeId;
                  t.expenseId = result.expenseId;
                  t.cardReceiptId = result.cardReceiptId;
                  t.reference = result.reference;
                  t.description = result.description;
                  t.amount = result.amount;
                  t.grossAmount = result.grossAmount;
                  t.totalGrossBalance = result.totalGrossBalance;
                  t.totalIOF = result.totalIOF;
                  t.totalIR = result.totalIR;
                  t.iofElapsedDays = result.iofElapsedDays;
                  t.note = result.note;
                  t.type = result.type;
                });

              this.accountpostings = [
                ...this.accountpostings.filter(
                  (ap) =>
                    ap.reference === this.reference &&
                    ap.accountId === this.accountId
                ),
              ];

              this.dataSource = new MatTableDataSource(this.accountpostings);
              this.prepareAccountPostingFocus(result.id);

              this.getTotalAmount();
              this.getAccountTotals();
              this.getAccountsList();
            },
            // error: () => this.hideProgress = true
          });
        }
      }
    });
  }

  addApplication() {
    const dialogRef = this.dialog.open(this.accountApplicationsDialogComponent, {
      width: '100%',
      maxWidth: '100%',
      panelClass: this.accountEntryDialogPanelClass,
      data: {
        reference: this.reference,
        accountId: this.accountId,
        editing: false,
        accountsList: this.accountsList,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        const payload = prepareApiDates(result, ['dateApplied', 'maturityDate']);
        this.accountApplicationsService.create(payload).subscribe({
          next: (accountApplication) => {
            if (accountApplication.accountId === this.accountId
            ) {
              this.accountApplications = [...this.accountApplications, accountApplication];

              this.accountApplicationsDataSource = new MatTableDataSource(this.accountApplications);

              // this.accountApplicationsLength = this.accountApplications.length;
            }

            this.getTotalApplications();
          },
          // error: () => this.hideProgress = true
        });
      }
    });
  }

  editOrDeleteApplication(accountApplication: AccountsApplications) {
    const dialogRef = this.dialog.open(this.accountApplicationsDialogComponent, {
      width: '100%',
      maxWidth: '100%',
      panelClass: this.accountEntryDialogPanelClass,
      data: {
        ...accountApplication,
        editing: true,
        accountsList: this.accountsList,
      },
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        if (result.deleting) {
          this.accountApplicationsService.delete(accountApplication.id!).subscribe({
            next: () => {
              this.accountApplications = this.accountApplications.filter(
                (t) => t.id! != accountApplication.id!
              );
              this.accountApplicationsDataSource = new MatTableDataSource(this.accountApplications);

              this.getTotalApplications();
            },
            // error: () => this.hideProgress = true
          });
        } else {
          const payload = prepareApiDates(result, ['dateApplied', 'maturityDate']);
          this.accountApplicationsService.update(payload).subscribe({
            next: () => {
              this.accountApplications
                .filter((t) => t.id === result.id)
                .map((t) => {
                  t.dateApplied = result.dateApplied;
                  t.accountId = result.accountId;
                  t.amountApplied = result.amountApplied;
                  t.maximumAmount = result.maximumAmount;
                  t.disabled = result.disabled;
                  t.cdiPercent = result.cdiPercent;
                  t.fixedRate = result.fixedRate;
                  t.maturityDate = result.maturityDate;
                });

              this.accountApplications = [
                ...this.accountApplications.filter(
                  (ap) =>
                    ap.accountId === this.accountId
                ),
              ];

              this.accountApplicationsDataSource = new MatTableDataSource(this.accountApplications);

              this.getTotalApplications();
            },
            // error: () => this.hideProgress = true
          });
        }
      }
    });
  }

  drop(event: CdkDragDrop<any[]>) {
    //const previousIndex = this.accountpostings.findIndex(row => row === event.item.data);

    moveItemInArray(
      this.accountpostings,
      event.previousIndex,
      event.currentIndex
    );

    this.accountpostings = this.accountpostings.slice();

    this.dataSource = new MatTableDataSource(this.accountpostings);

    let length = this.accountpostings.length;

    this.accountpostings.forEach((accountposting, index) => {
      accountposting.position = length - (index + 1);
    });

    let runningValue = this.previousBalance ?? 0;

    this.accountpostings
      .sort((a, b) => a.position! - b.position!)
      .forEach((accountposting) => {
        accountposting.runningAmount = runningValue += accountposting.amount;
      });

    this.accountpostings = [
      ...this.accountpostings.sort((a, b) => b.position! - a.position!),
    ];

    this.dataSource = new MatTableDataSource(this.accountpostings);

    this.accountPostingsService
      .updatePositions(this.accountpostings)
      .subscribe();
  }

  openFilter() {
    this.filterOpend = !this.filterOpend;

    this.cdr.detectChanges();

    if (this.filterOpend && this.filterInput?.nativeElement) {
      this.filterInput.nativeElement.focus();
    }
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;

    this.dataSource.filter = filterValue.trim().toLowerCase();

    this.getFilteredTotalAmount();
  }

  openAccountYields() {
    this.dialog.open(YieldsComponent, {
      width: '100%',
      maxWidth: '100%',
      panelClass: this.accountAuxDialogPanelClass,
      data: {
        reference: this.reference,
        accountId: this.accountId,
        title: 'Rendimentos da Conta',
        modernLayout: this.modernLayout,
      },
    });
  }

  openGeneralYields() {
    this.dialog.open(YieldsComponent, {
      width: '100%',
      maxWidth: '100%',
      panelClass: this.accountAuxDialogPanelClass,
      data: {
        reference: this.reference,
        accountId: null,
        title: 'Rendimentos Gerais',
        modernLayout: this.modernLayout,
      },
    });
  }

  openGenerateCardReceiptDialog(accountPosting: any) {
    const dialogRef = this.dialog.open(GenerateCardReceiptDialog, {
      width: '100%',
      maxWidth: '100%',
      panelClass: this.accountAuxDialogPanelClass,
      data: {
        amount: accountPosting.amount,
        date: accountPosting.date,
        description: accountPosting.description
      }
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) return;

      const peopleId = result.peopleId;
      const cardId = result.cardId;

      this.accountPostingsService.generateCardReceipt(accountPosting.id!, peopleId, cardId).subscribe({
        next: () => {
          this.messenger.message('Recebimento de cartão gerado com sucesso!', 5000);
        },
        // error: () => this.hideProgress = true
      });
    });
  }
}

