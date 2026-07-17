import { finalize, forkJoin } from 'rxjs';
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
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { People } from 'src/app/models/people.model';
import { PeopleService } from 'src/app/services/people/people.service';
import { AddvalueComponent } from 'src/app/shared/addvalue/addvalue.component';
import moment from 'moment';
import { ExpensesDialog } from './expenses-dialog';
import { IncomesDialog } from './incomes-dialog';
import { PaymentReceiveDialog } from './payment-receive-dialog';
import { CardPostingsDialog } from '../cardpostings/cardpostings-dialog/cardpostings-dialog';
import { PeopleComponent } from '../people/people.component';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { ConfirmDialogComponent, ConfirmDialogData } from 'src/app/shared/confirm-dialog/confirm-dialog.component';
import { CardsInvoiceClosing } from 'src/app/models/cardsinvoiceclosing.model';
import { CardsInvoiceClosingService } from 'src/app/services/cardsinvoiceclosing/cardsinvoiceclosing.service';

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
  validatingInvoiceClosing = false;
  isBudgetLoading = false;
  isBudgetLoaded = false;

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

  showUpcomingExpenses: boolean = false;
  upcomingDays: number = 7;
  onlyPendingExpenses: boolean = false;

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
  budgetPanelExpanded: boolean = false;
  expensesPanelExpanded: boolean = false;
  incomesPanelExpanded: boolean = false;
  peoplePanelExpanded: boolean = false;
  categoryPanelExpanded: boolean = false;
  showOptions = false;
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

  isOrderingByDueDate = false;
  creditCardsFirst = false;

  isMergingExpenses: boolean = false;
  selectedExpenseIdsToMerge: number[] = [];

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
    private invoiceClosingService: CardsInvoiceClosingService,
    private clipboardService: ClipboardService,
    private accountPostingsService: AccountPostingsService,
    private budget: BudgetService,
    private _liveAnnouncer: LiveAnnouncer,
    library: FaIconLibrary
  ) {
    library.addIcons(faWhatsapp);
  }

  private readonly portugueseCollator = new Intl.Collator('pt-BR', {
    usage: 'sort',
    sensitivity: 'base',
    numeric: true,
  });

  private sortPeople?: MatSort;
  private sortCategories?: MatSort;

  @ViewChild('sortPeople')
  set matSortPeople(sort: MatSort | undefined) {
    this.sortPeople = sort;
    this.bindPeopleSort();
  }

  @ViewChild('sortCategories')
  set matSortCategories(sort: MatSort | undefined) {
    this.sortCategories = sort;
    this.bindCategoriesSort();
  }

  private bindPeopleSort(): void {
    if (!this.sortPeople) return;

    this.dataSourcePeople.sortData = (
      data: CardsPostingsDTO[],
      sort: MatSort
    ): CardsPostingsDTO[] => {
      if (!sort.active || sort.direction === '') return data;

      const direction = sort.direction === 'asc' ? 1 : -1;

      return [...data].sort((a, b) => {
        let comparison = 0;

        switch (sort.active) {
          case 'person':
            comparison = this.portugueseCollator.compare(
              a.person ?? '',
              b.person ?? ''
            );
            break;

          case 'toReceive':
            comparison = (a.toReceive ?? 0) - (b.toReceive ?? 0);
            break;

          case 'received':
            comparison = (a.received ?? 0) - (b.received ?? 0);
            break;

          case 'remaining':
            comparison = (a.remaining ?? 0) - (b.remaining ?? 0);
            break;
        }

        return comparison * direction;
      });
    };

    this.dataSourcePeople.sort = this.sortPeople;
  }

  private bindCategoriesSort(): void {
    if (!this.sortCategories) return;

    this.dataSourceCategories.sortData = (
      data: ExpensesByCategories[],
      sort: MatSort
    ): ExpensesByCategories[] => {
      if (!sort.active || sort.direction === '') return data;

      const direction = sort.direction === 'asc' ? 1 : -1;

      return [...data].sort((a, b) => {
        let comparison = 0;

        switch (sort.active) {
          case 'category':
            comparison = this.portugueseCollator.compare(
              a.category ?? '',
              b.category ?? ''
            );
            break;

          case 'amount':
            comparison = (a.amount ?? 0) - (b.amount ?? 0);
            break;

          case 'perc':
            comparison = (a.perc ?? 0) - (b.perc ?? 0);
            break;
        }

        return comparison * direction;
      });
    };

    this.dataSourceCategories.sort = this.sortCategories;
  }

  ngOnInit() {
  }

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
    if (!this.expensesNoFilter) return;

    if (this.justToPay) {
      this.expenses = this.expensesNoFilter.filter((e) => e.remaining > 0);
    } else {
      this.expenses = this.expensesNoFilter;
    }

    this.getExpensesTotals();
    this.getIncomesTotals();
  }

  onCheckboxJustToReceiveChange(): void {
    if (!this.incomesNoFilter) return;

    if (this.justToReceive) {
      this.incomes = this.incomesNoFilter.filter((e) => e.remaining > 0);
    } else {
      this.incomes = this.incomesNoFilter;
    }

    this.getIncomesTotals();
  }

  refresh() {
    if (!this.reference) return;

    this.isBudgetLoading = true;
    this.isBudgetLoaded = false;

    this.showUpcomingExpenses = false;
    this.onlyPendingExpenses = false;

    const reference = this.reference;

    forkJoin({
      cards: this.cardService.read(),
      categories: this.categoryService.readWithExpenses(reference),
      people: this.peopleService.read(),
      accounts: this.accountService.readNotDisabled(),
      expenses: this.expenseService.read(reference, this.justMyValues),
      incomes: this.incomeService.read(reference, this.justMyValues),
      cardpostingspeople: this.cardPostingsService.readCardsPostingsPeople(0, reference),
      budgetTotals: this.budget.getBudgetTotals(reference),
      expensesByCategories: this.expenseService.readByCategories(reference, 0)
    })
      .pipe(
        finalize(() => {
          if (this.reference === reference) {
            this.isBudgetLoading = false;
          }
        })
      )
      .subscribe({
        next: ({
          cards,
          categories,
          people,
          accounts,
          expenses,
          incomes,
          cardpostingspeople,
          budgetTotals,
          expensesByCategories
        }) => {
          if (this.reference !== reference) return;

          this.cardsList = cards;

          this.categoriesList = categories.sort((a, b) =>
            this.portugueseCollator.compare(a.name ?? '', b.name ?? '')
          );

          this.peopleList = people.sort((a, b) =>
            this.portugueseCollator.compare(a.name ?? '', b.name ?? '')
          );
          
          this.accountsList = accounts;

          this.expenses = expenses;
          this.expensesNoFilter = expenses;

          if (this.justToPay) {
            this.expenses = this.expensesNoFilter.filter((e) => e.remaining > 0);
          }

          this.incomes = incomes;
          this.incomesNoFilter = incomes;

          if (this.justToReceive) {
            this.incomes = this.incomesNoFilter.filter((e) => e.remaining > 0);
          }

          this.cardpostingspeople = cardpostingspeople.filter(
            (t) => t.person !== ''
          );

          this.dataSourcePeople = new MatTableDataSource(this.cardpostingspeople);
          this.bindPeopleSort();

          this.budgetTotals = budgetTotals;

          this.expensesByCategories = expensesByCategories;
          this.dataSourceCategories = new MatTableDataSource(this.expensesByCategories);
          this.bindCategoriesSort();

          this.getExpensesTotals();
          this.getIncomesTotals();
          this.getTotalPeople();
          this.getTotalByCategories();

          this.checkExpensesWarnings();

          this.loadPanelState();

          this.isBudgetLoaded = true;
        },
        error: () => {
          if (this.reference !== reference) return;

          this.isBudgetLoaded = false;
        }
      });
  }

  private checkExpensesWarnings(): void {
    if (this.justMyValues) return;

    let overdue = false;
    let duetoday = false;

    this.expenses.forEach((expense) => {
      if (expense.dueDate && expense.paid < expense.toPay) {
        if (this.dueToday(expense)) {
          duetoday = true;
        } else if (this.overDue(expense)) {
          overdue = true;
        }
      }
    });

    let message = '';

    if (duetoday && overdue) {
      message = 'Há lançamentos vencidos e vencendo hoje!';
    } else if (duetoday) {
      message = 'Há lançamentos vencendo hoje!';
    } else if (overdue) {
      message = 'Há lançamentos vencidos!';
    }

    if (message) {
      this.messenger.message(message);
    }
  }

  private loadPanelState(): void {
    this.budgetPanelExpanded = localStorage.getItem('budgetPanelExpanded') === 'true';
    this.expensesPanelExpanded = localStorage.getItem('expensesPanelExpanded') === 'true';
    this.incomesPanelExpanded = localStorage.getItem('incomesPanelExpanded') === 'true';
    this.peoplePanelExpanded = localStorage.getItem('peoplePanelExpanded') === 'true';
    this.categoryPanelExpanded = localStorage.getItem('categoryPanelExpanded') === 'true';
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

          this.bindPeopleSort();

          this.getTotalPeople();
        },
        error: () => { },
      });
  }

  getExpensesByCategories() {
    this.expenseService.readByCategories(this.reference!, 0).subscribe({
      next: (expensesByCategories) => {
        this.expensesByCategories = expensesByCategories;

        this.dataSourceCategories = new MatTableDataSource(
          this.expensesByCategories
        );

        this.bindCategoriesSort();

        this.getTotalByCategories();
      },
      error: () => { },
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
      width: '100%',
      maxWidth: '100%',
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

            this.refreshExpenses();
          },
          error: () => {
          },
        });
      }
    });
  }

  refreshExpenses() {
    this.getBudgetTotals();
    this.getExpensesTotals();
    this.getExpensesByCategories();
  }

  orderExpensesByPreviousMonth(): void {
    this.expenseService.orderByPreviousMonth(this.reference!).subscribe({
      next: () => {
        this.refresh();
      },
      error: () => { },
    });
  }

  repeatPreviousExpensesMonth(): void {
    const dialogRef = this.dialog.open(
      ConfirmDialogComponent,
      {
        width: '400px',
        data: <ConfirmDialogData>{
          title: 'Repetir mês anterior',
          message:
            'Essa ação irá apagar TODAS as despesas do mês atual e recriar com base no mês anterior. Deseja continuar?',
          confirmText: 'Confirmar',
          cancelText: 'Cancelar',
        },
      }
    );

    dialogRef
      .afterClosed()
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;

        this.expenseService
          .repeatPreviousMonth(this.reference!)
          .subscribe({
            next: () => {
              this.refresh();
            },
            error: (e) => {
              this.messenger.errorHandler(e);
            },
          });
      });
  }

  editOrDeleteExpense(expense: Expenses, event: any): void {
    if (event.target.textContent! == 'more_vert') {
      return;
    }

    this.editing = true;

    const dialogRef = this.dialog.open(ExpensesDialog, {
      width: '100%',
      maxWidth: '100%',
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
        dueDay: expense.dueDay,
        expectedValue: expense.expectedValue,
        relatedId: expense.relatedId,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {

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
                  t.totalToPay = result.totalToPay;
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
                  t.fixed = result.fixed;
                  t.dueDay = result.dueDay;
                  t.expectedValue = result.expectedValue;
                  t.relatedId = result.relatedId;
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

              this.refreshExpenses();
            },
            error: () => {
            },
          });
        }
      }
    });
  }

  deleteExpense(expense: any) {
    this.expenseService.delete(expense.id).subscribe({
      next: () => {
        this.expenses = this.expenses.filter((t) => t.id! != expense.id!);
        this.expensesNoFilter = this.expensesNoFilter.filter(
          (t) => t.id! != expense.id!
        );

        this.refreshExpenses();
      },
      error: () => {
      },
    });
  }

  startMergeExpenses(): void {
    this.isMergingExpenses = true;
    this.selectedExpenseIdsToMerge = [];
  }

  cancelMergeExpenses(): void {
    this.isMergingExpenses = false;
    this.selectedExpenseIdsToMerge = [];
  }

  toggleExpenseToMerge(expense: Expenses): void {
    if (!expense?.id) return;

    const index = this.selectedExpenseIdsToMerge.indexOf(expense.id);

    if (index >= 0) {
      this.selectedExpenseIdsToMerge.splice(index, 1);
    } else {
      this.selectedExpenseIdsToMerge.push(expense.id);
    }

    this.selectedExpenseIdsToMerge = [...this.selectedExpenseIdsToMerge];
  }

  isExpenseSelectedToMerge(expense: Expenses): boolean {
    if (!expense?.id) return false;

    return this.selectedExpenseIdsToMerge.includes(expense.id);
  }

  canSelectExpenseToMerge(expense: Expenses): boolean {
    if (!expense) return false;

    return !expense.cardId &&
      !expense.peopleId &&
      !expense.relatedId &&
      (!expense.parcels || expense.parcels <= 1) &&
      (!expense.parcelNumber || expense.parcelNumber <= 1) &&
      expense.paid === 0;
  }

  openMergeExpensesDialog(): void {
    if (this.selectedExpenseIdsToMerge.length < 2) {
      this.messenger.message('Selecione ao menos 2 despesas para mesclar.');
      return;
    }

    // próxima etapa: abrir modal real
    console.log('Mesclar despesas:', this.selectedExpenseIdsToMerge);
  }

  addIncome(): void {
    this.editing = false;

    const dialogRef = this.dialog.open(IncomesDialog, {
      width: '100%',
      maxWidth: '100%',
      data: {
        reference: this.reference,
        editing: this.editing,
        cardsList: this.cardsList,
        accountsList: this.accountsList,
        peopleList: this.peopleList,
        typesList: this.typesList,
        parcels: 1,
        parcelNumber: 1,
        totalToReceive: 0,
        receiptDate: undefined,
        adding: true,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {

        result.position = this.incomes.length + 1;

        this.incomeService.create(result).subscribe({
          next: (incomes) => {
            //this.incomes.push(incomes); não funcionou assim como nas outras funções, acredito que seja por causa do Expension Panel (mat-expansion-panel)

            incomes.remaining = incomes.toReceive - incomes.received;
            incomes.totalToReceive = incomes.totalToReceive ?? incomes.toReceive;
            incomes.parcels = incomes.parcels ?? 1;
            incomes.parcelNumber = incomes.parcelNumber ?? 1;

            this.incomes = [...this.incomes, incomes]; // somente funcionou assim
            this.incomesNoFilter = [...this.incomesNoFilter, incomes];

            this.peopleList = result.peopleList;

            this.refreshIncomes();
          },
          error: () => { },
        });
      }
    });
  }

  refreshIncomes() {
    this.getCardsPostingsPeople();
    this.getBudgetTotals();
    this.getIncomesTotals();
  }

  orderIncomesByPreviousMonth(): void {
    this.incomeService.orderByPreviousMonth(this.reference!).subscribe({
      next: () => {
        this.refresh();
      },
      error: (e) => {
        this.messenger.errorHandler(e);
      },
    });
  }

  repeatPreviousMonth(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: <ConfirmDialogData>{
        title: 'Repetir mês anterior',
        message: 'Essa ação irá apagar TODAS as receitas do mês atual e recriar com base no mês anterior. Deseja continuar?',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.incomeService.repeatPreviousMonth(this.reference!).subscribe({
        next: () => {
          this.refresh();
        },
        error: (e) => {
          this.messenger.errorHandler(e);
        },
      });
    });
  }

  editOrDeleteIncome(income: Incomes, event: any) {
    if (event.target.textContent! == 'more_vert') {
      return;
    }

    this.editing = true;

    const dialogRef = this.dialog.open(IncomesDialog, {
      width: '100%',
      maxWidth: '100%',
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
        parcelNumber: income.parcelNumber,
        parcels: income.parcels,
        totalToReceive: income.totalToReceive,
        note: income.note,
        type: income.type,
        peopleId: income.peopleId,
        relatedId: income.relatedId,
        editing: this.editing,
        deleting: false,
        cardsList: this.cardsList,
        accountsList: this.accountsList,
        typesList: this.typesList,
        peopleList: this.peopleList,
        receiptDate: income.receiptDate,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {

        if (result.deleting) {
          this.incomeService.delete(result.id).subscribe({
            next: () => {
              this.incomes = this.incomes.filter((t) => t.id! != result.id!);
              this.incomesNoFilter = this.incomesNoFilter.filter(
                (t) => t.id! != result.id!
              );

              this.refreshIncomes();
            },
            error: () => { },
          });
        } else {
          this.incomeService.update(result).subscribe({
            next: (updatedIncome) => {
              const currentIncome = this.incomesNoFilter.find(
                (i) => i.id === updatedIncome.id
              );

              if (currentIncome) {
                Object.assign(currentIncome, updatedIncome);
              }

              this.incomesNoFilter = [
                ...this.incomesNoFilter.filter(
                  (i) => i.reference === this.reference
                ),
              ];

              this.incomes = this.justToReceive
                ? this.incomesNoFilter.filter((i) => i.remaining > 0)
                : [...this.incomesNoFilter];

              this.peopleList = result.peopleList;

              this.refreshIncomes();
            },
            error: () => { },
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
      width: '100%',
      maxWidth: '100%',
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
          },
          error: () => { },
        });
      }
    });
  }

  payWithCard(expense: Expenses) {
    if (this.validatingInvoiceClosing || !this.reference) return;

    const storedCardId = Number(localStorage.getItem('lastCardUsed'));
    const selectedCard = storedCardId > 0
      ? this.cardsList?.find(card => card.id === storedCardId)
      : undefined;

    if (!selectedCard) {
      this.openPayWithCardDialog(expense);
      return;
    }

    this.validatingInvoiceClosing = true;
    this.invoiceClosingService.ensure(storedCardId, this.reference).pipe(
      finalize(() => this.validatingInvoiceClosing = false)
    ).subscribe({
      next: invoiceClosing => this.openPayWithCardDialog(expense, storedCardId, invoiceClosing)
    });
  }

  private openPayWithCardDialog(expense: Expenses, cardId?: number, invoiceClosing?: CardsInvoiceClosing): void {
    const dialogRef = this.dialog.open(CardPostingsDialog, {
      width: '100%',
      maxWidth: '100%',
      data: {
        reference: this.reference,
        cardId,
        invoiceClosing,
        allowClosedInvoiceOperation: false,
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
        provisioned: false,
        dueDate: expense.dueDate,
        isPaid: true,
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
      width: '100%',
      maxWidth: '100%',
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

            this.refreshIncomes();

            localStorage.setItem('accountIdReceiveIncome', result.accountId);
          },
          error: () => { },
        });
      }
    });
  }

  addValue(row: any, type: string) {
    const dialogRef = this.dialog.open(AddvalueComponent, {
      width: '100%',
      maxWidth: '100%',
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

  expenseClone(row: Expenses): void {
    const clone = {
      ...row,

      // campos que NÃO podem ser reaproveitados
      id: undefined,
      generateParcels: false,
      repeatExpense: false
    };

    this.expenseService.create(clone).subscribe({
      next: (expenses) => {
        expenses.remaining = expenses.toPay - expenses.paid;

        expenses.overdue = this.overDue(expenses);
        expenses.duetoday = this.dueToday(expenses);

        this.expenses = [...this.expenses, expenses];
        this.expensesNoFilter = [...this.expensesNoFilter, expenses];

        this.refreshExpenses();
      },
      error: () => { },
    });
  }

  incomeClone(row: Incomes): void {
    const clone = {
      ...row,

      // campos que NÃO podem ser reaproveitados
      id: undefined,
      relatedId: undefined,
      generateParcels: false,
      repeatIncome: false,
      repeatToNextMonths: false
    };

    this.incomeService.create(clone).subscribe({
      next: (incomes) => {
        incomes.remaining = incomes.toReceive - incomes.received;

        this.incomes = [...this.incomes, incomes];
        this.incomesNoFilter = [...this.incomesNoFilter, incomes];

        this.refreshIncomes();
      },
      error: () => { },
    });
  }

  editPeople(cpp: CardsPostingsDTO) {
    let person = this.peopleList!.find(c => c.id === cpp.peopleId);

    person!.canDelete = false;
    person!.editing = true;

    const dialogRef = this.dialog.open(PeopleComponent, {
      width: '400px',
      data: { ...person }, // envia cópia para evitar mutação imediata
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // atualiza os dados em cpp
        cpp.peopleId = result.id;
        cpp.person = result.name;
        cpp.phoneNumber = result.phoneNumber;

        // atualiza a lista peopleList
        this.peopleList = this.peopleList!.map(p =>
          p.id === result.id ? result : p
        );
      }
    });
  }

  charge(cpp: CardsPostingsDTO, noFee: boolean = false) {
    let message = '';
    const hour = new Date().getHours();

    if (hour < 12) message = 'Bom dia!';
    else if (hour < 18) message = 'Boa tarde!';
    else message = 'Boa noite!';

    this.cardPostingsService.readByPeopleId(cpp.peopleId, this.reference!, 0).subscribe({
      next: (cardPostingsPeople) => {
        message += '\nSeguem os valores deste mês:';

        // ✅ Corrigir bug do mês 13
        const refYear = Number(this.reference!.substring(0, 4));
        const refMonth = Number(this.reference!.substring(4, 6)) - 1;
        const vencDate = new Date(refYear, refMonth + 1); // mês já começa do zero

        const vencimento = vencDate.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        });

        message += `\n\n*Vencimento ${vencimento}*\n\n`;
        message += '```';

        cardPostingsPeople.cardsPostings.forEach((cp) => {
          const strAmount = cp.amount
            .toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
            .replace('R$ ', '')
            .padStart(8, ' ');

          const strParcels =
            cp.parcels! > 1 ? ` (${cp.parcelNumber}/${cp.parcels})` : '';

          message += `${strAmount} ${cp.description}${strParcels}\n`;
        });

        cardPostingsPeople.incomes.forEach((i) => {
          const strAmount = i.toReceive
            .toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
            .replace(/^R\$\s?/, '')
            .padStart(8, ' ');

          const strParcels =
            i.parcels! > 1 ? ` (${i.parcelNumber}/${i.parcels})` : '';

          message += `${strAmount} ${i.description}${strParcels}\n`;
        });

        const tax = noFee ? 0 : 3;
        if (!noFee) {
          const strTax = tax
            .toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
            .replace(/^R\$\s?/, '')
            .padStart(8, ' ');
          message += `${strTax} Tarifa de Serviços\n`;
        }

        const received =
          cpp.received > 0
            ? (
              '-' +
              cpp.received
                .toLocaleString('pt-br', { style: 'currency', currency: 'BRL' })
                .replace(/^R\$\s?/, '')
            ).padStart(8, ' ') + ' (Valor pago)\n'
            : '';

        message += received;

        const total = (cpp.remaining + tax).toLocaleString('pt-br', {
          style: 'currency',
          currency: 'BRL',
        });

        message += '----------------------------```\n';
        message += `*Total: ${total}*`;
        message += '\n\n*PIX: (92)98447-9364*';

        this.clipboardService.copy(message);

        if (cpp.phoneNumber) {
          // ✅ Formatar número e redirecionar pro WhatsApp
          const encodedMessage = encodeURIComponent(message);

          let phone = cpp.phoneNumber.replace(/\D/g, ''); // remove tudo que não for número

          if (!phone.startsWith('55')) {
            phone = '55' + phone;
          }

          const whatsappURL = `https://wa.me/${phone}?text=${encodedMessage}`;
          window.open(whatsappURL, '_blank');
        } else {
          this.messenger.message('Mensagem copiada para área de transferência.');
        }
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
          .readByPeopleId(row.peopleId, row.reference, row.cardId)
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
    if (!(expense.dueDate && expense.paid < expense.toPay)) {
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
    if (!(expense.dueDate && expense.paid < expense.toPay)) {
      return false;
    }

    let today = new Date();

    today.setHours(0, 0, 0, 0);

    let dueDate = new Date(expense.dueDate!);

    dueDate.setHours(0, 0, 0, 0);

    expense.overdue = today.getTime() > dueDate.getTime();

    return expense.overdue;
  }

  filterUpcomingExpenses(): void {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + this.upcomingDays);

    this.expenses = this.showUpcomingExpenses
      ? this.expensesNoFilter.filter((e) => {
        if (!e.dueDate) return false;

        const due = new Date(e.dueDate);
        due.setHours(0, 0, 0, 0);

        const isWithinRange = due >= now && due <= nextDate;
        const isPending =
          !this.onlyPendingExpenses || (e.remaining && e.remaining > 0);

        return isWithinRange && isPending;
      })
      : [...this.expensesNoFilter];

    this.getExpensesTotals();
  }

  removeFromUpcomingFilter(row: any): void {
    this.expenses = this.expenses.filter((e) => e !== row);
    this.getExpensesTotals();
  }

  orderByDueDate(): void {
    this.isOrderingByDueDate = true;

    // Ordena a lista original (sem filtro aplicado)
    const sorted = [...this.expensesNoFilter].sort((a, b) => {
      const dateA = a.dueDate ? new Date(a.dueDate) : null;
      const dateB = b.dueDate ? new Date(b.dueDate) : null;

      if (this.creditCardsFirst) {
        const isCardA = !!a.cardId;
        const isCardB = !!b.cardId;

        if (isCardA !== isCardB) {
          return isCardA ? -1 : 1;
        }
      }

      if (dateA && dateB) {
        return dateA.getTime() - dateB.getTime();
      } else if (dateA) {
        return -1;
      } else if (dateB) {
        return 1;
      } else {
        return 0;
      }
    });

    // Atualiza posições e persiste
    sorted.forEach((expense, index) => {
      expense.position = index + 1;
      this.expenseService.update(expense).subscribe(); // grava no backend
    });

    this.expenses = sorted;
    this.getExpensesTotals();
  }

  ajustarDespesaPorCategoria(expense: any): void {
    if (!expense?.id) return;

    this.expenseService.ajustarPorCategoria(expense.id).subscribe({
      next: (res) => {
        this.messenger.message('Despesa ajustada com sucesso');

        Object.assign(expense, res);

        this.refreshExpenses();
      },
      error: (err) => {
        this.messenger.errorHandler(err);
      }
    });
  }

  handleClickExpense(expense: Expenses, event: MouseEvent): void {
    if (this.isMergingExpenses) {
      event.stopPropagation();

      if (!this.canSelectExpenseToMerge(expense)) {
        this.messenger.message('Só é possível mesclar despesas manuais simples.');
        return;
      }

      this.toggleExpenseToMerge(expense);
      return;
    }

    this.editOrDeleteExpense(expense, event);
  }

  handleDoubleClickExpense(expense: Expenses, event: MouseEvent): void {
    if (this.isMergingExpenses) {
      event.stopPropagation();
      return;
    }

    this.updateExpense(expense);
  }

  updateExpense(expense: Expenses): void {
    this.expenseService.readById(expense.id).subscribe({
      next: (res: Expenses) => {
        Object.assign(expense, res);
        this.refreshExpenses();
      },
      error: (err) => {
        this.messenger.errorHandler(err);
      }
    });
  }

  handleClickIncome(income: Incomes, event: MouseEvent): void {
    this.editOrDeleteIncome(income, event);

    // const now = new Date().getTime();
    // const timeSinceLast = now - this.lastClickTime;

    // this.lastClickTime = now;

    // if (timeSinceLast < 300) {
    //   return;
    // }

    // this.clickTimer = setTimeout(() => {
    //   const since = new Date().getTime() - this.lastClickTime;

    //   if (since >= 300) {
    //     this.editOrDeleteIncome(income, event);
    //   }
    // }, 300);
  }

  handleDoubleClickIncome(income: Incomes, event: MouseEvent): void {
    // clearTimeout(this.clickTimer);
    this.updateIncome(income);
  }

  updateIncome(income: Incomes): void {
    this.incomeService.readById(income.id).subscribe({
      next: (res: Incomes) => {
        Object.assign(income, res);
        this.refreshIncomes();
      },
      error: (err) => {
        this.messenger.errorHandler(err);
      }
    });
  }

  getExpectedBalanceWithoutYields(): number {
    return this.expectedBalance - (this.budgetTotals?.myYields || 0);
  }

  getExpectedBalanceWithoutYieldsPerc(): number {
    if (this.expectedBalance <= 0) return 0;

    return this.getExpectedBalanceWithoutYields() / this.expectedBalance * 100;
  }

  getExpectedBalanceYieldsCompositionPerc(): number {
    const yields = this.budgetTotals?.myYields || 0;

    if (this.expectedBalance <= 0) return 0;

    return yields / this.expectedBalance * 100;
  }

  getExpectedBalanceDeficitReductionPerc(): number {
    const yields = this.budgetTotals?.myYields || 0;
    const originalDeficit = Math.abs(this.getExpectedBalanceWithoutYields());

    if (originalDeficit === 0) return 0;

    return yields / originalDeficit * 100;
  }

  getExpectedBalanceCoveredByYieldsPerc(): number {
    const yields = this.budgetTotals?.myYields || 0;
    const originalDeficit = Math.abs(this.getExpectedBalanceWithoutYields());

    if (yields === 0) return 0;

    return originalDeficit / yields * 100;
  }

  getExpectedBalancePositiveFromYieldsPerc(): number {
    const yields = this.budgetTotals?.myYields || 0;

    if (yields === 0) return 0;

    return this.expectedBalance / yields * 100;
  }

  openExpectedBalanceInfo(): void {
    const withoutYields = this.getExpectedBalanceWithoutYields();
    const yields = this.budgetTotals?.myYields ?? 0;
    const expectedBalance = this.expectedBalance;

    const incomePerc = this.getExpectedBalanceIncomePerc();
    const withoutYieldsIncomePerc = this.getExpectedBalanceWithoutYieldsIncomePerc();

    const withoutYieldsFormatted = this.formatCurrencyValue(withoutYields);
    const yieldsFormatted = this.formatCurrencyValue(yields);
    const expectedBalanceFormatted = this.formatCurrencyValue(expectedBalance);

    const incomePercFormatted =
      incomePerc === null
        ? 'Não calculado'
        : incomePerc.toFixed(2).replace('.', ',') + '%';

    const withoutYieldsIncomePercFormatted =
      withoutYieldsIncomePerc === null
        ? 'Não calculado'
        : withoutYieldsIncomePerc.toFixed(2).replace('.', ',') + '%';

    let compositionMessage = '';

    if (withoutYields >= 0 && expectedBalance > 0) {
      const withoutYieldsPerc = this
        .getExpectedBalanceWithoutYieldsPerc()
        .toFixed(2)
        .replace('.', ',');

      const yieldsPerc = this
        .getExpectedBalanceYieldsCompositionPerc()
        .toFixed(2)
        .replace('.', ',');

      compositionMessage =
        'Composição do saldo\n' +
        'Sem rendimentos: ' +
        withoutYieldsFormatted +
        ' (' +
        withoutYieldsPerc +
        '% do saldo final)\n' +
        'Rendimentos: ' +
        yieldsFormatted +
        ' (' +
        yieldsPerc +
        '% do saldo final)\n\n' +
        'Linha inferior da tela\n' +
        withoutYieldsPerc +
        '%: parte do saldo formada sem rendimentos.\n' +
        yieldsPerc +
        '%: parte do saldo formada pelos rendimentos.';
    } else if (withoutYields >= 0 && expectedBalance === 0) {
      compositionMessage =
        'Composição do saldo\n' +
        'Sem rendimentos: ' +
        withoutYieldsFormatted +
        '\n' +
        'Rendimentos: ' +
        yieldsFormatted +
        '\n\n' +
        'Resultado\n' +
        'O saldo previsto final ficou zerado.';
    } else if (expectedBalance < 0) {
      const reductionPerc = this
        .getExpectedBalanceDeficitReductionPerc()
        .toFixed(2)
        .replace('.', ',');

      compositionMessage =
        'Composição do déficit\n' +
        'Saldo sem rendimentos: ' +
        withoutYieldsFormatted +
        '\n' +
        'Rendimentos: ' +
        yieldsFormatted +
        '\n\n' +
        'Impacto dos rendimentos\n' +
        'Os rendimentos reduziram o déficit original em ' +
        reductionPerc +
        '%, mas o saldo final permaneceu negativo.\n\n' +
        'Linha inferior da tela\n' +
        '100%: déficit original sem rendimentos.\n' +
        '↓' +
        reductionPerc +
        '%: redução do déficit causada pelos rendimentos.';
    } else if (expectedBalance === 0) {
      compositionMessage =
        'Composição do saldo\n' +
        'Saldo sem rendimentos: ' +
        withoutYieldsFormatted +
        '\n' +
        'Rendimentos: ' +
        yieldsFormatted +
        '\n\n' +
        'Impacto dos rendimentos\n' +
        'Os rendimentos cobriram exatamente todo o déficit original.\n\n' +
        'Linha inferior da tela\n' +
        'O percentual esquerdo, 100%, indica que todo o rendimento foi necessário para zerar o déficit. ' +
        'O percentual direito fica em 0%, pois não restou saldo positivo.';
    } else {
      const coveredPerc = this
        .getExpectedBalanceCoveredByYieldsPerc()
        .toFixed(2)
        .replace('.', ',');

      const positivePerc = this
        .getExpectedBalancePositiveFromYieldsPerc()
        .toFixed(2)
        .replace('.', ',');

      compositionMessage =
        'Composição do saldo\n' +
        'Saldo sem rendimentos: ' +
        withoutYieldsFormatted +
        '\n' +
        'Rendimentos: ' +
        yieldsFormatted +
        '\n\n' +
        'Uso dos rendimentos\n' +
        coveredPerc +
        '% dos rendimentos cobriu o déficit original.\n' +
        positivePerc +
        '% permaneceu como saldo positivo.\n\n' +
        'Linha inferior da tela\n' +
        coveredPerc +
        '%: parte dos rendimentos usada para eliminar o déficit.\n' +
        positivePerc +
        '%: parte dos rendimentos que permaneceu no saldo final.';
    }

    const message =
      'Saldo previsto final\n' +
      expectedBalanceFormatted +
      '\n\n' +
      'Percentuais principais\n' +
      withoutYieldsIncomePercFormatted +
      ': economia ou déficit em relação às minhas receitas, desconsiderando os rendimentos.\n' +
      incomePercFormatted +
      ': saldo previsto total, incluindo rendimentos, em relação às minhas receitas totais.\n\n' +
      compositionMessage;

    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: <ConfirmDialogData>{
        title: 'Cálculo do Saldo Previsto',
        message: message,
        confirmText: 'Entendi',
        cancelText: ''
      },
    });
  }

  formatCurrencyValue(value: number): string {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  getExpectedBalanceIncomePerc(): number | null {
    const myIncomes = Math.abs(this.budgetTotals?.myIncomes ?? 0);

    if (myIncomes === 0) return null;

    return this.expectedBalance / myIncomes * 100;
  }

  getExpectedBalanceWithoutYieldsIncomePerc(): number | null {
    const incomesWithoutYields =
      this.budgetTotals?.myIncomesWithoutYields ?? 0;

    const myExpenses =
      this.budgetTotals?.myExpenses ?? 0;

    if (incomesWithoutYields === 0) return null;

    const balanceWithoutYields =
      incomesWithoutYields - myExpenses;

    return balanceWithoutYields /
      Math.abs(incomesWithoutYields) *
      100;
  }
}
