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
import moment from 'moment';
import { MatTableDataSource } from '@angular/material/table';
import { AccountPostingsDialog } from './accountpostings-dialog';
import { YieldsComponent } from '../yields/yields.component';

@Component({
  selector: 'app-accountpostings',
  templateUrl: './accountpostings.component.html',
  styleUrls: ['./accountpostings.component.scss'],
})
export class AccountPostingsComponent implements OnInit, AfterViewInit {
  @Input() accountId?: number;
  @Input() reference?: string;

  // two-way binding [(accountsList)]
  @Output() accountsListChange = new EventEmitter<Accounts[]>();

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
  incomes!: Incomes[];
  expenses!: Expenses[];
  displayedColumns = [
    'index',
    'date',
    'description',
    'amount',
    'runningAmount',
  ];
  total: number = 0;
  grandTotalBalance?: number = 0;
  grandTotalYields?: number = 0;
  totalBalance?: number = 0;
  previousBalance?: number = 0;
  totalYields?: number = 0;
  hideProgress: boolean = true;
  editing: boolean = false;
  maxBalance: number = 0;
  minBalance: number = 0;
  accountPostingsLength: number = 0;

  filterOpend: boolean = false;
  dataSource = new MatTableDataSource(this.accountpostings);

  constructor(
    private accountPostingsService: AccountPostingsService,
    private accountService: AccountService,
    private incomeService: IncomeService,
    private expenseService: ExpenseService,
    public dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {

  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accountId']?.currentValue || changes['reference']?.currentValue)
      this.refresh();
  }

  private rebindAccount(): void {
    // pega SEMPRE a versão mais recente do item dentro da lista nova
    this.account =
      this._accountsList?.find(a => a.id === this.accountId) ?? null;

    // se o componente usa OnPush / ou o update veio fora da zona
    this.cdr.markForCheck();
    // em cenários teimosos (animações/overlays), pode forçar:
    // setTimeout(() => this.cdr.detectChanges(), 0);
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
        this.accountsList = accounts.sort((a, b) =>
          a.name.localeCompare(b.name)
        );

        this.account = this.accountsList?.find((a) => a.id === this.accountId)!;

        this.accountsListChange.emit(this.accountsList);

        this.hideProgress = true;
      },
      error: () => (this.hideProgress = true),
    });
  }

  refresh() {
    this.getLists();

    if (this.accountId) {
      this.hideProgress = false;

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
    }
  }

  getAccountTotals() {
    this.accountService
      .getAccountTotals(this.accountId, this.reference)
      .subscribe({
        next: (account) => {
          this.grandTotalBalance = account.grandTotalBalance;
          this.grandTotalYields = account.grandTotalYields;
          this.totalBalance = account.totalBalance;
          this.previousBalance = account.previousBalance;
          this.totalYields = account.totalYields;

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
        },
        error: () => (this.hideProgress = true),
      });
  }

  getTotalAmount() {
    this.total = this.accountpostings
      ? this.accountpostings
        .map((t) => t.amount)
        .reduce((acc, value) => acc + value, 0)
      : 0;
  }

  getFilteredTotalAmount() {
    this.total = this.dataSource.filteredData
      ? Array(this.dataSource.filteredData)[0]
        .map((t) => t.amount)
        .reduce((acc, value) => acc + value, 0)
      : 0;
  }

  getLastYield() {
    // Filtra a data e verifica se existe um valor com tipo 'Y'
    let lastYield =
      this.dataSource.filteredData.filter((t) => t.type === 'Y').length > 0
        ? this.dataSource.filteredData.filter((t) => t.type === 'Y')[0].amount
        : 0;

    this.refreshAccountsList(lastYield);

    return lastYield;
  }

  refreshAccountsList(lastYield?: number, totalBalanceGross?: number) {
    const account = this.accountsList?.find((a) => a.id === this.accountId);

    if (account) {
      // Atualiza o valor de lastYield no accountsList
      if (lastYield !== undefined)
        account.lastYield = lastYield;

      // Emite a alteração para o componente pai
      this.accountsListChange.emit(this.accountsList);
    }
  }

  add() {
    this.editing = false;

    const dialogRef = this.dialog.open(AccountPostingsDialog, {
      width: '100%',
      maxWidth: '100%',
      data: {
        reference: this.reference,
        accountId: this.accountId,
        editing: this.editing,
        type: 'R',
        accountsList: this.accountsList,
        incomesList: this.incomes,
        expensesList: this.expenses,
        totalBalance: this.totalBalance,
        lastYield: this.getLastYield(),
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // this.hideProgress = false;

        result.amount = result.amount * (result.type === 'P' ? -1 : 1);

        result.position = this.accountpostings.length + 1;

        Date.prototype.toJSON = function () {
          return moment(this).format('YYYY-MM-DDThh:mm:00.000Z');
        };

        this.accountPostingsService.create(result).subscribe({
          next: (accountpostings) => {
            if (
              accountpostings.reference === this.reference &&
              accountpostings.accountId === this.accountId
            ) {
              this.accountpostings = [...this.accountpostings, accountpostings];

              this.dataSource = new MatTableDataSource(this.accountpostings);

              this.accountPostingsLength = this.accountpostings.length;
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

  editOrDelete(accountPosting: AccountsPostings) {
    this.editing = true;

    const dialogRef = this.dialog.open(AccountPostingsDialog, {
      width: '100%',
      maxWidth: '100%',
      data: {
        id: accountPosting.id,
        accountId: accountPosting.accountId,
        date: accountPosting.date,
        reference: accountPosting.reference,
        position: accountPosting.position,
        description: accountPosting.description,
        amount: accountPosting.amount,
        note: accountPosting.note,
        editing: this.editing,
        accountsList: this.accountsList,
        deleting: false,
        type: accountPosting.type,
        cardReceiptId: accountPosting.cardReceiptId,
        expenseId: accountPosting.expenseId,
        incomeId: accountPosting.incomeId,
        incomesList: this.incomes,
        expensesList: this.expenses,
        totalBalance: this.totalBalance,
        lastYield: this.getLastYield(),
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

          this.accountPostingsService.update(result).subscribe({
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

    if (this.filterOpend) {
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
      data: {
        reference: this.reference,
        accountId: this.accountId,
        title: 'Rendimentos da Conta',
      },
    });
  }

  openGeneralYields() {
    this.dialog.open(YieldsComponent, {
      width: '100%',
      maxWidth: '100%',
      data: {
        reference: this.reference,
        accountId: null,
        title: 'Rendimentos Gerais',
      },
    });
  }
}

