import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { ClipboardService } from 'ngx-clipboard';
import { Messenger } from 'src/app/common/messenger';
import { Accounts } from 'src/app/models/accounts.model';
import { Cards } from 'src/app/models/cards.model';
import { CardsPostingsDTO } from 'src/app/models/cardspostingsdto.model';
import { Expenses } from 'src/app/models/expenses.model';
import { Incomes } from 'src/app/models/incomes.model';
import { AccountService } from 'src/app/services/account/account.service';
import { CardService } from 'src/app/services/card/card.service';
import { CardPostingsService } from 'src/app/services/cardpostings/cardpostings.service';
import { ExpenseService } from 'src/app/services/expense/expense.service';
import { IncomeService } from 'src/app/services/income/income.service';
import { AccountPostingsService } from 'src/app/services/accountpostings/accountpostings.service';
import { BudgetTotals } from './../../models/budgettotals';
import { BudgetService } from 'src/app/services/budget/budget.service';
import { Categories } from 'src/app/models/categories.model';
import { CategoryService } from 'src/app/services/category/category.service';
import { ExpensesByCategories } from 'src/app/models/expensesbycategories';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { People } from 'src/app/models/people.model';
import { PeopleService } from 'src/app/services/people/people.service';
import { AddvalueComponent } from 'src/app/shared/addvalue/addvalue.component';
import moment from 'moment';
import { ExpensesDialog } from './expenses-dialog';
import { IncomesDialog } from './incomes-dialog';
import { PaymentReceiveDialog } from './payment-receive-dialog';
import { CardPostingsDialog } from '../cardpostings/cardpostings-dialog';

@Component({
  selector: 'app-budget',
  templateUrl: './budget.component.html',
  styleUrls: ['./budget.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition(
        'expanded <=> collapsed',
        animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')
      ),
    ]),
    trigger('peopleDetailExpand', [
      state('collapsed', style({ height: '0px', minHeight: '0' })),
      state('expanded', style({ height: '*' })),
      transition(
        'expanded <=> collapsed',
        animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')
      ),
    ]),
  ],
})
export class BudgetComponent implements OnInit, AfterViewInit {
  reference?: string;
  referenceHead?: string;

  expenses!: Expenses[];
  expensesNoFilter!: Expenses[];
  incomes!: Incomes[];
  incomesNoFilter!: Incomes[];
  expensesByCategories!: ExpensesByCategories[];
  budgetTotals?: BudgetTotals;
  cardpostingspeople!: CardsPostingsDTO[];
  dataSourcePeople = new MatTableDataSource(this.cardpostingspeople);
  dataSourceCategories = new MatTableDataSource(this.expensesByCategories);

  expended: boolean = false;

  displayedExpensesColumns = [
    'description',
    'toPay',
    'paid',
    'remaining',
    'actions',
  ];
  displayedIncomesColumns = [
    'description',
    'toReceive',
    'received',
    'remaining',
    'actions',
  ];
  displayedPeopleColumns = [
    'person',
    'toReceive',
    'received',
    'remaining',
    'actions',
  ];
  displayedCategoriesColumns = ['category', 'amount', 'perc'];

  toPayTotal: number = 0;
  toPayTotalNoFilter: number = 0;
  paidTotal: number = 0;
  expensesRemainingTotal?: number = 0;
  expectedBalance: number = 0;
  toReceiveTotal: number = 0;
  toReceiveTotalNoFilter: number = 0;
  receivedTotal: number = 0;
  incomesRemainingTotal: number = 0;
  toReceiveTotalPeople: number = 0;
  receivedTotalPeople: number = 0;
  remainingTotalPeople: number = 0;
  amountTotalCategory: number = 0;
  percTotalCategory: number = 0;
  monthName: string = '';
  hideExpensesProgress: boolean = true;
  hideIncomesProgress: boolean = true;
  hidePeopleProgress: boolean = true;
  hideCategoriesProgress: boolean = true;
  budgetPanelExpanded: boolean = false;
  expensesPanelExpanded: boolean = false;
  incomesPanelExpanded: boolean = false;
  peoplePanelExpanded: boolean = false;
  categoryPanelExpanded: boolean = false;
  justMyValues: boolean = false;
  justToPay: boolean = false;
  justToReceive: boolean = false;
  editing: boolean = false;
  cardsList?: Cards[];
  categoriesList?: Categories[];
  accountsList?: Accounts[];
  peopleList?: People[];
  typesList = [
    {
      id: 'R',
      description: 'Recebimento',
    },
    // {
    //   id: 'P',
    //   description: 'Pagamento'
    // },
    {
      id: 'Y',
      description: 'Rendimento',
    },
    {
      id: 'C',
      description: 'Troco',
    },
  ];

  constructor(
    private expenseService: ExpenseService,
    private incomeService: IncomeService,
    private cardPostingsService: CardPostingsService,
    private cd: ChangeDetectorRef,
    public dialog: MatDialog,
    private cardService: CardService,
    private peopleService: PeopleService,
    private categoryService: CategoryService,
    private accountService: AccountService,
    private messenger: Messenger,
    private clipboardService: ClipboardService,
    private accountPostingsService: AccountPostingsService,
    private budget: BudgetService,
    private _liveAnnouncer: LiveAnnouncer
  ) {}

  @ViewChild('sortPeople') sortPeople!: MatSort;
  @ViewChild('sortCategories') sortCategories!: MatSort;

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.cd.detectChanges();
  }

  /** Announce the change in sort state for assistive technology. */
  announceSortChange(sortState: any) {
    // This example uses English messages. If your application supports
    // multiple language, you would internationalize these strings.
    // Furthermore, you can customize the message to add additional
    // details about the values being sorted.

    if (sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }

  referenceChanges(reference: string) {
    this.reference = reference;

    this.referenceHead =
      this.reference.substr(4, 2) + '/' + this.reference.substr(0, 4);

    this.refresh();
  }

  onCheckboxJustMyValuesChange(): void {
    this.refresh();
  }

  onCheckboxJustToPayChange(): void {
    debugger;
    if (this.justToPay) {
      this.expenses = this.expensesNoFilter.filter((e) => e.remaining > 0);
    } else {
      this.expenses = this.expensesNoFilter;
    }

    this.getIncomesTotals();
    this.getExpensesTotals();
  }

  onCheckboxJustToReceiveChange(): void {
    if (this.justToReceive) {
      this.incomes = this.incomesNoFilter.filter((e) => e.remaining > 0);
    } else {
      this.incomes = this.incomesNoFilter;
    }
  }

  refresh() {
    this.hideExpensesProgress = false;
    this.hideIncomesProgress = false;
    this.hidePeopleProgress = false;
    this.hideCategoriesProgress = false;

    this.cardService.read().subscribe({
      next: (cards) => {
        this.cardsList = cards;
      },
      error: () => {
        this.hideExpensesProgress = false;
        this.hideIncomesProgress = false;
        this.hidePeopleProgress = false;
        this.hideCategoriesProgress = false;
      },
    });

    this.categoryService.read().subscribe({
      next: (categories) => {
        this.categoriesList = categories.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      },
      error: () => {
        this.hideExpensesProgress = false;
        this.hideIncomesProgress = false;
        this.hidePeopleProgress = false;
        this.hideCategoriesProgress = false;
      },
    });

    this.peopleService.read().subscribe({
      next: (people) => {
        this.peopleList = people;
      },
      error: () => {
        this.hideExpensesProgress = false;
        this.hideIncomesProgress = false;
        this.hidePeopleProgress = false;
        this.hideCategoriesProgress = false;
      },
    });

    this.accountService.readNotDisabled().subscribe({
      next: (accounts) => {
        this.accountsList = accounts;

        this.hideExpensesProgress = true;
        this.hideIncomesProgress = true;
        this.hidePeopleProgress = true;
        this.hideCategoriesProgress = true;
      },
      error: () => {
        this.hideExpensesProgress = true;
        this.hideIncomesProgress = true;
        this.hidePeopleProgress = true;
        this.hideCategoriesProgress = true;
      },
    });

    this.getData();

    this.budgetPanelExpanded =
      localStorage.getItem('budgetPanelExpanded') === 'true';
    this.expensesPanelExpanded =
      localStorage.getItem('expensesPanelExpanded') === 'true';
    this.incomesPanelExpanded =
      localStorage.getItem('incomesPanelExpanded') === 'true';
    this.peoplePanelExpanded =
      localStorage.getItem('peoplePanelExpanded') === 'true';
    this.categoryPanelExpanded =
      localStorage.getItem('categoryPanelExpanded') === 'true';
  }

  getData() {
    if (this.reference) {
      this.hideExpensesProgress = false;
      this.hideIncomesProgress = false;
      this.hidePeopleProgress = false;
      this.hideCategoriesProgress = false;

      this.expenses = [];
      this.expensesNoFilter = [];
      this.incomes = [];
      this.incomesNoFilter = [];
      this.cardpostingspeople = [];

      this.getExpenses();
      this.getIncomes();
      this.getCardsPostingsPeople();
      this.getBudgetTotals();
      this.getExpensesByCategories();
    }
  }

  getExpenses() {
    this.expenseService.read(this.reference!, this.justMyValues).subscribe({
      next: (expenses) => {
        this.expenses = expenses;
        this.expensesNoFilter = expenses;

        this.getExpensesTotals();

        if (this.justToPay) this.onCheckboxJustToPayChange();

        if (this.justMyValues) {
          return;
        }

        let overdue = false; // se houver algum lançamento atrasado
        let duetoday = false; // se houver algum lançamento vencendo hoje

        this.expenses.forEach((expense) => {
          if (expense.dueDate && expense.paid < expense.toPay) {
            if (this.dueToday(expense)) {
              duetoday = true;
            } else if (this.overDue(expense)) {
              overdue = true;
            }
          }
        });

        if (duetoday && overdue) {
          this.messenger.message('Há lançamentos vencidos e vencendo hoje!');
        } else if (duetoday) {
          this.messenger.message('Há lançamentos vencendo hoje!');
        } else if (overdue) {
          this.messenger.message('Há lançamentos vencidos!');
        }
      },
      error: () => {
        this.getExpensesTotals();
      },
    });
  }

  getIncomes() {
    this.incomeService.read(this.reference!, this.justMyValues).subscribe({
      next: (incomes) => {
        this.incomes = incomes;
        this.incomesNoFilter = incomes;

        if (this.justToReceive) this.onCheckboxJustToReceiveChange();

        this.getIncomesTotals();
      },
      error: () => {
        this.getIncomesTotals();
      },
    });
  }

  getBudgetTotals() {
    this.budget.getBudgetTotals(this.reference!).subscribe({
      next: (budgetTotals) => {
        this.budgetTotals = budgetTotals;
      },
    });
  }

  getCardsPostingsPeople() {
    this.cardPostingsService
      .readCardsPostingsPeople(0, this.reference!)
      .subscribe({
        next: (cardpostingspeople) => {
          // this.cardpostingspeople = cardpostingspeople.sort((a, b) => a.person.localeCompare(b.person)).filter(t => t.person !== '');
          this.cardpostingspeople = cardpostingspeople.filter(
            (t) => t.person !== ''
          );

          this.dataSourcePeople = new MatTableDataSource(
            this.cardpostingspeople
          );

          this.dataSourcePeople.sort = this.sortPeople;

          this.getTotalPeople();

          this.hidePeopleProgress = true;
        },
        error: () => (this.hidePeopleProgress = true),
      });
  }

  getExpensesByCategories() {
    this.expenseService.readByCategories(this.reference!, 0).subscribe({
      next: (expensesByCategories) => {
        this.expensesByCategories = expensesByCategories;

        this.dataSourceCategories = new MatTableDataSource(
          this.expensesByCategories
        );

        this.dataSourceCategories.sort = this.sortCategories;

        this.getTotalByCategories();

        this.hideCategoriesProgress = true;
      },
      error: () => (this.hideCategoriesProgress = true),
    });
  }

  getIncomesTotals() {
    this.toReceiveTotal = this.incomes
      ? this.incomes
          .map((t) => t.toReceive)
          .reduce((acc, value) => acc + value, 0)
      : 0;

    this.receivedTotal = this.incomes
      ? this.incomes
          .map((t) => t.received)
          .reduce((acc, value) => acc + value, 0)
      : 0;

    this.incomesRemainingTotal = this.incomes
      ? this.incomes
          .map((t) => t.remaining)
          .reduce((acc, value) => acc + value, 0)
      : 0;

    this.toReceiveTotalNoFilter = this.incomesNoFilter
      ? this.incomesNoFilter
          .map((t) => t.toReceive)
          .reduce((acc, value) => acc + value, 0)
      : 0;

    this.expectedBalance =
      this.toReceiveTotalNoFilter - this.toPayTotalNoFilter;

    this.hideIncomesProgress = true;
  }

  getExpensesTotals() {
    this.toPayTotal = this.expenses
      ? this.expenses.map((t) => t.toPay).reduce((acc, value) => acc + value, 0)
      : 0;

    this.paidTotal = this.expenses
      ? this.expenses.map((t) => t.paid).reduce((acc, value) => acc + value, 0)
      : 0;

    this.expensesRemainingTotal = this.expenses
      ? this.expenses
          .map((t) => t.remaining)
          .reduce((acc, value) => acc! + value!, 0)
      : 0;

    this.toPayTotalNoFilter = this.expensesNoFilter
      ? this.expensesNoFilter
          .map((t) => t.toPay)
          .reduce((acc, value) => acc + value, 0)
      : 0;

    this.expectedBalance =
      this.toReceiveTotalNoFilter - this.toPayTotalNoFilter;

    this.hideExpensesProgress = true;
  }

  getTotalPeople() {
    this.toReceiveTotalPeople = this.cardpostingspeople
      ? this.cardpostingspeople
          .map((t) => t.toReceive)
          .reduce((acc, value) => acc + value, 0)
      : 0;

    this.receivedTotalPeople = this.cardpostingspeople
      ? this.cardpostingspeople
          .map((t) => t.received)
          .reduce((acc, value) => acc + value, 0)
      : 0;

    this.remainingTotalPeople = this.cardpostingspeople
      ? this.cardpostingspeople
          .map((t) => t.remaining)
          .reduce((acc, value) => acc + value, 0)
      : 0;
  }

  getTotalByCategories() {
    this.amountTotalCategory = this.expensesByCategories
      ? this.expensesByCategories
          .map((t) => t.amount!)
          .reduce((acc, value) => acc + value, 0)
      : 0;

    this.percTotalCategory = this.expensesByCategories
      ? this.expensesByCategories
          .map((t) => t.perc!)
          .reduce((acc, value) => acc + value, 0)
      : 0;
  }

  getPeopleCardsPostingsTotal(cardpostingspeople: CardsPostingsDTO) {
    return cardpostingspeople.cardsPostings
      .map((t) => t.amount)
      .reduce((acc, value) => acc + value, 0);
  }

  getPeopleAccountsPostingsTotal(cardpostingspeople: CardsPostingsDTO) {
    return cardpostingspeople.accountsPostings
      .map((t) => t.amount)
      .reduce((acc, value) => acc + value, 0);
  }

  getPeopleIncomesToReceiveTotal(cardpostingspeople: CardsPostingsDTO) {
    return cardpostingspeople.incomes
      .map((t) => t.toReceive)
      .reduce((acc, value) => acc + value, 0);
  }

  getPeopleIncomesReceivedTotal(cardpostingspeople: CardsPostingsDTO) {
    return cardpostingspeople.incomes
      .map((t) => t.received)
      .reduce((acc, value) => acc + value, 0);
  }

  getPeopleIncomesRemaingTotal(cardpostingspeople: CardsPostingsDTO) {
    return cardpostingspeople.incomes
      .map((t) => t.toReceive - t.received)
      .reduce((acc, value) => acc + value, 0);
  }

  addExpense(): void {
    this.editing = false;

    const dialogRef = this.dialog.open(ExpensesDialog, {
      width: '400px',
      data: {
        reference: this.reference,
        editing: this.editing,
        cardsList: this.cardsList,
        categoriesList: this.categoriesList,
        peopleList: this.peopleList,
        parcels: 1,
        parcelNumber: 1,
        adding: true,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.hideExpensesProgress = false;
        this.hideCategoriesProgress = false;

        result.position = this.expenses.length + 1;

        this.expenseService.create(result).subscribe({
          next: (expenses) => {
            expenses.remaining = expenses.toPay - expenses.paid;

            //this.expenses.push(expenses); não funcionou assim como nas outras funções, acredito que seja por causa do Expension Panel (mat-expansion-panel)

            expenses.overdue = this.overDue(expenses);
            expenses.duetoday = this.dueToday(expenses);

            this.expenses = [...this.expenses, expenses]; // somente funcionou assim
            this.expensesNoFilter = [...this.expensesNoFilter, expenses];

            this.categoriesList = result.categoriesList;
            this.peopleList = result.peopleList;

            this.getBudgetTotals();
            this.getExpensesTotals();
            this.getExpensesByCategories();
          },
          error: () => {
            this.hideExpensesProgress = true;
            this.hideCategoriesProgress = true;
          },
        });
      }
    });
  }

  orderExpensesByPreviousMonth(): void {
    this.expenseService.orderByPreviousMonth(this.reference!).subscribe({
      next: () => {
        this.refresh();
      },
      error: () => {},
    });
  }

  editOrDeleteExpense(expense: Expenses, event: any): void {
    if (event.target.textContent! == 'more_vert') {
      return;
    }

    this.editing = true;

    const dialogRef = this.dialog.open(ExpensesDialog, {
      width: '400px',
      data: {
        id: expense.id,
        userId: expense.userId,
        cardId: expense.cardId,
        categoryId: expense.categoryId,
        reference: expense.reference,
        position: expense.position,
        description: expense.description,
        toPay: expense.toPay,
        totalToPay: expense.totalToPay,
        paid: expense.paid,
        remaining: expense.remaining,
        note: expense.note,
        peopleId: expense.peopleId,
        dueDate: expense.dueDate,
        parcelNumber: expense.parcelNumber,
        parcels: expense.parcels,
        scheduled: expense.scheduled,
        editing: this.editing,
        deleting: false,
        cardsList: this.cardsList,
        categoriesList: this.categoriesList,
        peopleList: this.peopleList,
        fixed: expense.fixed,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.hideExpensesProgress = false;
        this.hideCategoriesProgress = false;

        if (result.deleting) {
          this.deleteExpense(result);
        } else {
          this.expenseService.update(result).subscribe({
            next: () => {
              this.expenses
                .filter((t) => t.id === result.id)
                .map((t) => {
                  t.id = result.id;
                  t.userId = result.userId;
                  t.reference = result.reference;
                  t.position = result.position;
                  t.description = result.description;
                  t.toPay = result.toPay;
                  t.totalToPay = result.toPay;
                  t.paid = result.paid;
                  t.remaining = result.remaining;
                  t.note = result.note;
                  t.cardId = result.cardId;
                  t.categoryId = result.categoryId;
                  t.dueDate = result.dueDate;
                  t.parcelNumber = result.parcelNumber;
                  t.parcels = result.parcels;
                  t.scheduled = result.scheduled;
                  t.peopleId = result.peopleId;
                  t.overdue = this.overDue(t);
                  t.duetoday = this.dueToday(t);
                });

              this.expenses = [
                ...this.expenses.filter((e) => e.reference === this.reference),
              ];

              this.expensesNoFilter = [
                ...this.expensesNoFilter.filter(
                  (e) => e.reference === this.reference
                ),
              ];

              this.categoriesList = result.categoriesList;
              this.peopleList = result.peopleList;

              this.getBudgetTotals();
              this.getExpensesTotals();
              this.getExpensesByCategories();
            },
            error: () => {
              this.hideExpensesProgress = true;
              this.hideCategoriesProgress = true;
            },
          });
        }
      }
    });
  }

  private deleteExpense(expense: any) {
    this.expenseService.delete(expense.id).subscribe({
      next: () => {
        this.expenses = this.expenses.filter((t) => t.id! != expense.id!);
        this.expensesNoFilter = this.expensesNoFilter.filter(
          (t) => t.id! != expense.id!
        );

        this.getBudgetTotals();
        this.getExpensesTotals();
        this.getExpensesByCategories();
      },
      error: () => {
        this.hideExpensesProgress = true;
        this.hideCategoriesProgress = true;
      },
    });
  }

  addIncome(): void {
    this.editing = false;

    const dialogRef = this.dialog.open(IncomesDialog, {
      width: '400px',
      data: {
        reference: this.reference,
        editing: this.editing,
        cardsList: this.cardsList,
        accountsList: this.accountsList,
        peopleList: this.peopleList,
        typesList: this.typesList,
        adding: true,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.hideIncomesProgress = false;

        result.position = this.incomes.length + 1;

        this.incomeService.create(result).subscribe({
          next: (incomes) => {
            //this.incomes.push(incomes); não funcionou assim como nas outras funções, acredito que seja por causa do Expension Panel (mat-expansion-panel)

            incomes.remaining = incomes.toReceive - incomes.received;

            this.incomes = [...this.incomes, incomes]; // somente funcionou assim
            this.incomesNoFilter = [...this.incomesNoFilter, incomes];

            this.peopleList = result.peopleList;

            this.getCardsPostingsPeople();
            this.getBudgetTotals();
            this.getIncomesTotals();
          },
          error: () => (this.hideIncomesProgress = true),
        });
      }
    });
  }

  orderIncomesByPreviousMonth(): void {
    this.incomeService.orderByPreviousMonth(this.reference!).subscribe({
      next: () => {
        this.refresh();
      },
      error: () => {},
    });
  }

  editOrDeleteIncome(income: Incomes, event: any) {
    if (event.target.textContent! == 'more_vert') {
      return;
    }

    this.editing = true;

    const dialogRef = this.dialog.open(IncomesDialog, {
      width: '400px',
      data: {
        id: income.id,
        userId: income.userId,
        cardId: income.cardId,
        accountId: income.accountId,
        reference: income.reference,
        position: income.position,
        description: income.description,
        toReceive: income.toReceive,
        received: income.received,
        remaining: income.remaining,
        note: income.note,
        type: income.type,
        peopleId: income.peopleId,
        editing: this.editing,
        deleting: false,
        cardsList: this.cardsList,
        accountsList: this.accountsList,
        typesList: this.typesList,
        peopleList: this.peopleList,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.hideIncomesProgress = false;

        if (result.deleting) {
          this.incomeService.delete(result.id).subscribe({
            next: () => {
              this.incomes = this.incomes.filter((t) => t.id! != result.id!);
              this.incomesNoFilter = this.incomesNoFilter.filter(
                (t) => t.id! != result.id!
              );

              this.getCardsPostingsPeople();
              this.getBudgetTotals();
              this.getIncomesTotals();
            },
            error: () => (this.hideIncomesProgress = true),
          });
        } else {
          this.incomeService.update(result).subscribe({
            next: () => {
              this.incomes
                .filter((t) => t.id === result.id)
                .map((t) => {
                  t.id = result.id;
                  t.userId = result.userId;
                  t.reference = result.reference;
                  t.position = result.position;
                  t.description = result.description;
                  t.toReceive = result.toReceive;
                  t.received = result.received;
                  t.remaining = result.remaining;
                  t.note = result.note;
                  t.cardId = result.cardId;
                  t.accountId = result.accountId;
                  t.type = result.type;
                  t.peopleId = result.peopleId;
                });

              this.incomes = [
                ...this.incomes.filter((i) => i.reference === this.reference),
              ];

              this.incomesNoFilter = [
                ...this.incomesNoFilter.filter(
                  (i) => i.reference === this.reference
                ),
              ];

              this.peopleList = result.peopleList;

              this.getCardsPostingsPeople();
              this.getBudgetTotals();
              this.getIncomesTotals();
            },
            error: () => (this.hideIncomesProgress = true),
          });
        }
      }
    });
  }

  budgetPanelClosed() {
    localStorage.setItem('budgetPanelExpanded', 'false');
  }

  budgetPanelOpened() {
    localStorage.setItem('budgetPanelExpanded', 'true');
  }

  expensesPanelClosed() {
    localStorage.setItem('expensesPanelExpanded', 'false');
  }

  expensesPanelOpened() {
    localStorage.setItem('expensesPanelExpanded', 'true');
  }

  incomesPanelClosed() {
    localStorage.setItem('incomesPanelExpanded', 'false');
  }

  peoplePanelClosed() {
    localStorage.setItem('peoplePanelExpanded', 'false');
  }

  incomesPanelOpened() {
    localStorage.setItem('incomesPanelExpanded', 'true');
  }

  peoplePanelOpened() {
    localStorage.setItem('peoplePanelExpanded', 'true');
  }

  categoryPanelClosed() {
    localStorage.setItem('categoryPanelExpanded', 'false');
  }

  categoryPanelOpened() {
    localStorage.setItem('categoryPanelExpanded', 'true');
  }

  pay(expense: Expenses) {
    const dialogRef = this.dialog.open(PaymentReceiveDialog, {
      width: '400px',
      data: {
        reference: expense.reference,
        description: 'Pag. ' + expense.description,
        amount: expense.remaining == expense.toPay ? expense.remaining : null,
        remaining: expense.remaining,
        note: expense.note,
        type: 'P',
        expenseId: expense.id,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.hideExpensesProgress = false;

        result.amount = result.amount * (result.type === 'P' ? -1 : 1);

        Date.prototype.toJSON = function () {
          return moment(this).format('YYYY-MM-DDThh:mm:00.000Z');
        };

        this.accountPostingsService.create(result).subscribe({
          next: () => {
            expense.paid = +(expense.paid + Math.abs(result.amount)).toFixed(2);
            expense.remaining = +(expense.toPay - expense.paid).toFixed(2);
            expense.scheduled = false;
            expense.overdue = false;
            expense.duetoday = false;

            this.getExpensesTotals();

            if (result.type === 'P') {
              localStorage.setItem('accountIdPayExpense', result.accountId);
            } else if (result.type === 'R') {
              localStorage.setItem('accountIdReceiveIncome', result.accountId);
            }

            this.hideExpensesProgress = true;
          },
          error: () => (this.hideExpensesProgress = true),
        });
      }
    });
  }

  payWithCard(expense: Expenses) {
    const dialogRef = this.dialog.open(CardPostingsDialog, {
      width: '400px',
      data: {
        reference: this.reference,
        // cardId: this.cardId,
        description: expense.categoryId ? expense.description : '',
        parcels: expense.parcels,
        parcelNumber: expense.parcelNumber,
        totalAmount: expense.categoryId ? expense.totalToPay : null,
        amount: expense.categoryId ? expense.toPay : null,
        categoryId: expense.categoryId,
        peopleId: expense.peopleId,
        note: expense.note,
        peopleList: this.peopleList,
        categoriesList: this.categoriesList,
        cardsList: this.cardsList,
        editing: false,
        adding: true,
        payWithCard: true,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        Date.prototype.toJSON = function () {
          return moment(this).format('YYYY-MM-DDThh:mm:00.000Z');
        };

        this.cardPostingsService.create(result).subscribe({
          next: (cardpostings) => {
            if (cardpostings) {
              if (result.amount >= expense.toPay) {
                this.deleteExpense(expense);
              } else {
                this.expenseService
                  .updateValue(expense.id!, result.amount * -1)
                  .subscribe({
                    next: () => {
                      expense.toPay = +(expense.toPay - result.amount).toFixed(
                        2
                      );
                      expense.totalToPay = +(
                        expense.totalToPay - result.amount
                      ).toFixed(2);
                      expense.remaining = +(
                        expense.toPay - (expense.paid ?? 0)
                      ).toFixed(2);

                      this.getExpensesTotals();
                    },
                  });
              }
            }

            this.categoriesList = result.categoriesList;
            this.peopleList = result.peopleList;

            this.getCardsPostingsPeople();
          },
        });
      }
    });
  }

  receive(income: Incomes) {
    const dialogRef = this.dialog.open(PaymentReceiveDialog, {
      width: '400px',
      data: {
        reference: income.reference,
        description: 'Rec. ' + income.description,
        amount: income.remaining == income.toReceive ? income.remaining : null,
        remaining: income.remaining,
        note: income.note,
        type: 'R',
        incomeId: income.id,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.hideExpensesProgress = false;

        result.amount = result.amount * (result.type === 'P' ? -1 : 1);

        Date.prototype.toJSON = function () {
          return moment(this).format('YYYY-MM-DDThh:mm:00.000Z');
        };

        this.accountPostingsService.create(result).subscribe({
          next: () => {
            income.received = +(
              income.received + Math.abs(result.amount)
            ).toFixed(2);
            income.remaining = +(income.toReceive - income.received).toFixed(2);

            this.getIncomesTotals();

            localStorage.setItem('accountIdReceiveIncome', result.accountId);

            this.hideExpensesProgress = true;
          },
          error: () => (this.hideExpensesProgress = true),
        });
      }
    });
  }

  addValue(row: any, type: string) {
    const dialogRef = this.dialog.open(AddvalueComponent, {
      width: '400px',
      data: {
        id: row.id,
        description: row.description,
        type: type,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        if (result.type === 'P') {
          this.expenseService.updateValue(result.id, result.amount).subscribe({
            next: () => {
              row.toPay = +(row.toPay + result.amount).toFixed(2);
              row.totalToPay = +(row.totalToPay + result.amount).toFixed(2);
              row.remaining = +(row.toPay - (row.paid ?? 0)).toFixed(2);

              this.getExpensesTotals();
            },
          });
        } else if (result.type === 'R') {
          this.incomeService.updateValue(result.id, result.amount).subscribe({
            next: () => {
              row.toReceive = +(row.toReceive + result.amount).toFixed(2);
              row.remaining = +(row.toReceive - (row.received ?? 0)).toFixed(2);

              this.getIncomesTotals();
            },
          });
        }
      }
    });
  }

  charge(cpp: CardsPostingsDTO, noFee: boolean = false) {
    let message = '';

    let hour = new Date().getHours();

    if (hour < 12) {
      message = 'Bom dia!';
    } else if (hour < 18) {
      message = 'Boa tarde!';
    } else {
      message = 'Boa noite!';
    }

    this.cardPostingsService
      .readByPeopleId(cpp.person, this.reference!, 0)
      .subscribe({
        next: (cardPostingsPeople) => {
          message += '\nSeguem os valores deste mês:';
          let month = Number(this.reference?.substring(4, 6));
          message +=
            '\n\n*Vencimento 01/' +
            (month + 1).toString().padStart(2, '0') +
            '*\n\n';
          message += '```';

          cardPostingsPeople.cardsPostings.forEach((cp) => {
            let strAmount = cp.amount
              .toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
              .replace('R$ ', '')
              .padStart(8, ' ');

            let strParcels =
              cp.parcels! > 1
                ? ' (' + cp.parcelNumber! + '/' + cp.parcels! + ')'
                : '';

            message += strAmount + ' ' + cp.description + strParcels + '\n';
          });

          cardPostingsPeople.incomes.forEach((i) => {
            let strAmount = i.toReceive
              .toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
              .replace('R$ ', '')
              .padStart(8, ' ');

            message += strAmount + ' ' + i.description + '\n';
          });

          let tax = noFee ? 0 : 3;

          if (!noFee) {
            message +=
              tax
                .toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
                .replace('R$ ', '')
                .padStart(8, ' ') + ' Tarifa de Serviços\n';
          }

          let received =
            cpp.received > 0
              ? (
                  '-' +
                  cpp.received
                    .toLocaleString('pt-br', {
                      style: 'currency',
                      currency: 'BRL',
                    })
                    .replace('R$ ', '')
                ).padStart(8, ' ') + ' (Valor pago)\n'
              : '';

          message += received;

          let total = (cpp.remaining + tax).toLocaleString('pt-br', {
            style: 'currency',
            currency: 'BRL',
          });

          message += '----------------------------```\n';
          message += '*Total: ' + total + '*';

          message += '\n\n*PIX: (92)98447-9364*';

          console.log(message);

          this.clipboardService.copy(message);

          this.messenger.message(
            'Mensagem copiada para área de transferência.'
          );
        },
      });
  }

  dropExpenses(event: CdkDragDrop<any[]>) {
    if (this.justToPay) return;

    const previousIndex = this.expenses.findIndex(
      (row) => row === event.item.data
    );

    moveItemInArray(this.expenses, previousIndex, event.currentIndex);

    this.expenses = this.expenses.slice();

    this.expenses.forEach((expense, index) => {
      expense.position = index + 1;

      this.expenseService.update(expense).subscribe();
    });
  }

  dropIncomes(event: CdkDragDrop<any[]>) {
    if (this.justToReceive) return;

    const previousIndex = this.incomes.findIndex(
      (row) => row === event.item.data
    );

    moveItemInArray(this.incomes, previousIndex, event.currentIndex);

    this.incomes = this.incomes.slice();

    this.incomes.forEach((expense, index) => {
      expense.position = index + 1;

      this.incomeService.update(expense).subscribe();
    });
  }

  toggleRow(row: ExpensesByCategories) {
    // Uncommnet to open only single row at once
    // ELEMENT_DATA.forEach(row => {
    //   row.expanded = false;
    // })

    row.expanding = true;

    if (row.expanded) {
      row.expanded = false;

      row.expanding = false;
    } else {
      row.expanded = true;

      if (row.expenses == null && row.cardsPostings == null) {
        this.expenseService.readByCategory(row).subscribe({
          next: (expensesByCategories) => {
            row.expenses = expensesByCategories.expenses;
            row.cardsPostings = expensesByCategories.cardsPostings;

            row.expanding = false;
          },
          error: () => (row.expanding = false),
        });
      } else {
        row.expanding = false;
      }
    }
  }

  peopleToggleRow(row: CardsPostingsDTO, event: any) {
    if (event.target.textContent! == 'more_vert') {
      return;
    }

    // Uncommnet to open only single row at once
    // ELEMENT_DATA.forEach(row => {
    //   row.expanded = false;
    // })

    row.expanding = true;

    if (row.expanded) {
      row.expanded = false;

      row.expanding = false;
    } else {
      row.expanded = true;

      if (row.cardsPostings == null) {
        this.cardPostingsService
          .readByPeopleId(row.person, row.reference, row.cardId)
          .subscribe({
            next: (people) => {
              row.cardsPostings = people.cardsPostings;
              row.incomes = people.incomes;
              // row.cardsReceipts = people.cardsReceipts;
              row.accountsPostings = people.accountsPostings;

              row.expanding = false;
            },
            error: () => (row.expanding = false),
          });
      } else {
        row.expanding = false;
      }
    }
  }

  dueToday(expense: Expenses) {
    if (!expense.dueDate) {
      return false;
    }

    let today = new Date();

    today.setHours(0, 0, 0, 0);

    let dueDate = new Date(expense.dueDate!);

    dueDate.setHours(0, 0, 0, 0);

    expense.duetoday = today.getTime() == dueDate.getTime();

    return expense.duetoday;
  }

  overDue(expense: Expenses) {
    if (!expense.dueDate) {
      return false;
    }

    let today = new Date();

    today.setHours(0, 0, 0, 0);

    let dueDate = new Date(expense.dueDate!);

    dueDate.setHours(0, 0, 0, 0);

    expense.overdue = today.getTime() > dueDate.getTime();

    return expense.overdue;
  }
}
