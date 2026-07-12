import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { Accounts } from 'src/app/models/accounts.model';
import { Cards } from 'src/app/models/cards.model';
import { Categories } from 'src/app/models/categories.model';
import { AccountService } from 'src/app/services/account/account.service';
import { CardService } from 'src/app/services/card/card.service';
import { CategoryService } from 'src/app/services/category/category.service';
import { DatepickerComponent } from 'src/app/shared/datepicker/datepicker.component';

@Component({
  selector: 'app-report',
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.scss'],
})
export class ReportComponent implements OnInit, AfterViewInit {
  initialReference: string | undefined;
  finalReference: string | undefined;
  initialMonthName: string | undefined;
  finalMonthName: string | undefined;
  reportPanelExpanded: boolean = true;
  selectedReportType: number | undefined;
  reportType: number | undefined;
  reports = [
    { id: 1, name: 'Despesas Fixas' },
    { id: 2, name: 'Despesas de Terceiros' },
    { id: 3, name: 'Despesas por Categoria' },
    { id: 4, name: 'Despesas por Data de Vencimento' },
    { id: 5, name: 'Despesas por Cartão' },
    { id: 6, name: 'Saldo Previsto em Conta' },
    { id: 7, name: 'Saúde Financeira' },
  ];
  showReport: boolean = false;
  categories: Categories[] = [];
  categoryId: number | undefined;
  initialDateValue: Date | null = null;
  finalDateValue: Date | null = null;

  groupByCategory: boolean = false;
  showCategoryChart: boolean = false;

  allCards: Cards[] = [];
  cards: Cards[] = [];
  cardId: number = 0;
  showDisabledCards: boolean = false;
  onlyMyCardExpenses: boolean = false;
  groupByCard: boolean = false;
  showCardChart: boolean = false;

  forecastAccounts: Accounts[] = [];
  forecastAccountId: number = 0;
  forecastInitialDateValue: Date | null = null;
  forecastFinalDateValue: Date | null = null;

  financialHealthReserveTargetMonths: number = 9;
  financialHealthFutureMonths: number = 12;
  financialHealthIncludeCurrentMonth: boolean = false;
  readonly financialHealthReserveTargetOptions = [3, 6, 9, 12, 18, 24];
  readonly financialHealthFutureMonthOptions = [6, 12, 18, 24, 36];

  @ViewChild('reportInitialDatepicker') reportInitialDatepicker!: DatepickerComponent;
  @ViewChild('reportFinalDatepicker') reportFinalDatepicker!: DatepickerComponent;

  constructor(
    private categoryService: CategoryService,
    private cardService: CardService,
    private accountService: AccountService
  ) { }

  ngOnInit(): void {
    this.selectedReportType = parseInt(
      localStorage.getItem('lastSelectedReport')!
    );

    this.categoryService.read().subscribe((categories) => {
      this.categories = categories.sort((a, b) => a.name.localeCompare(b.name));

      this.categoryId = parseInt(
        localStorage.getItem('lastSelectedCategoryReport') || '0'
      );
    });

    this.cardService.read().subscribe((cards) => {
      this.allCards = cards.sort((a, b) => a.name.localeCompare(b.name));
      this.cardId = parseInt(localStorage.getItem('lastSelectedCardReport') || '0');
      this.refreshCards();
    });

    this.accountService.read().subscribe((accounts) => {
      this.forecastAccounts = accounts.sort((a, b) => {
        const positionComparison = (a.position ?? Number.MAX_SAFE_INTEGER) -
          (b.position ?? Number.MAX_SAFE_INTEGER);

        return positionComparison !== 0
          ? positionComparison
          : a.name.localeCompare(b.name);
      });

      this.forecastAccountId = parseInt(
        localStorage.getItem('lastSelectedForecastAccountReport') || '0'
      );

      if (
        this.forecastAccountId !== 0 &&
        !this.forecastAccounts.some(account => account.id === this.forecastAccountId)
      ) {
        this.forecastAccountId = 0;
        localStorage.setItem('lastSelectedForecastAccountReport', '0');
      }
    });

    const initialDateStr = localStorage.getItem('report4InitialDate');
    const finalDateStr = localStorage.getItem('report4FinalDate');

    if (initialDateStr) {
      this.initialDateValue = new Date(initialDateStr);
    }

    if (finalDateStr) {
      this.finalDateValue = new Date(finalDateStr);
    }

    const forecastInitialDateStr = localStorage.getItem('report6InitialDate');
    const forecastFinalDateStr = localStorage.getItem('report6FinalDate');

    if (forecastInitialDateStr) {
      this.forecastInitialDateValue = new Date(forecastInitialDateStr);
    }

    if (forecastFinalDateStr) {
      this.forecastFinalDateValue = new Date(forecastFinalDateStr);
    }

    this.groupByCategory = localStorage.getItem('report3GroupByCategory') === 'true';
    this.showCategoryChart = localStorage.getItem('report3ShowCategoryChart') === 'true';

    this.showDisabledCards = localStorage.getItem('report5ShowDisabledCards') === 'true';
    this.onlyMyCardExpenses = localStorage.getItem('report5OnlyMyCardExpenses') === 'true';
    this.groupByCard = localStorage.getItem('report5GroupByCard') === 'true';
    this.showCardChart = localStorage.getItem('report5ShowCardChart') === 'true';

    this.financialHealthReserveTargetMonths = this.readStoredNumber(
      'report7ReserveTargetMonths',
      9,
      this.financialHealthReserveTargetOptions
    );

    this.financialHealthFutureMonths = this.readStoredNumber(
      'report7FutureMonths',
      12,
      this.financialHealthFutureMonthOptions
    );

    this.financialHealthIncludeCurrentMonth =
      localStorage.getItem('report7IncludeCurrentMonth') === 'true';
  }


  ngAfterViewInit(): void {
    setTimeout(() => this.ensureFinancialHealthDefaultPeriod());
  }

  get forecastReportInvalid(): boolean {
    if (this.selectedReportType !== 6) {
      return false;
    }

    if (
      !this.forecastAccountId ||
      !this.forecastInitialDateValue ||
      !this.forecastFinalDateValue
    ) {
      return true;
    }

    return this.forecastInitialDateValue > this.forecastFinalDateValue;
  }

  get financialHealthReportInvalid(): boolean {
    if (this.selectedReportType !== 7) {
      return false;
    }

    if (!this.initialReference || !this.finalReference) {
      return true;
    }

    if (this.initialReference > this.finalReference) {
      return true;
    }

    const currentDate = new Date();
    const maximumHistoricalDate = this.financialHealthIncludeCurrentMonth
      ? new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
      : new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);

    if (this.initialReference > this.toReference(maximumHistoricalDate)) {
      return true;
    }

    return !this.financialHealthReserveTargetOptions.includes(
      this.financialHealthReserveTargetMonths
    ) || !this.financialHealthFutureMonthOptions.includes(
      this.financialHealthFutureMonths
    );
  }

  get reportInvalid(): boolean {
    return this.forecastReportInvalid || this.financialHealthReportInvalid;
  }

  initialReferenceChanges(reference: string) {
    this.initialReference = reference;
  }

  finalReferenceChanges(reference: string) {
    this.finalReference = reference;
  }

  reportPanelClosed() {
    localStorage.setItem('reportPanelExpanded', 'false');
  }

  reportPanelOpened() {
    localStorage.setItem('reportPanelExpanded', 'true');
  }

  reportTypeChanges(event: MatSelectChange) {
    this.selectedReportType = event.value;
    localStorage.setItem(
      'lastSelectedReport',
      this.selectedReportType!.toString()
    );
    this.reportType = undefined;

    setTimeout(() => this.ensureFinancialHealthDefaultPeriod());
  }

  categoryChanges(event: MatSelectChange) {
    this.categoryId = event.value;
    localStorage.setItem(
      'lastSelectedCategoryReport',
      this.categoryId!.toString()
    );
  }

  cardChanges(event: MatSelectChange) {
    this.cardId = event.value ?? 0;
    localStorage.setItem('lastSelectedCardReport', this.cardId.toString());
  }

  forecastAccountChanges(event: MatSelectChange) {
    this.forecastAccountId = event.value ?? 0;
    localStorage.setItem(
      'lastSelectedForecastAccountReport',
      this.forecastAccountId.toString()
    );
  }

  financialHealthReserveTargetChanged(value: number) {
    this.financialHealthReserveTargetMonths = value;
    localStorage.setItem('report7ReserveTargetMonths', value.toString());
  }

  financialHealthFutureMonthsChanged(value: number) {
    this.financialHealthFutureMonths = value;
    localStorage.setItem('report7FutureMonths', value.toString());
  }

  financialHealthIncludeCurrentMonthChanged(value: boolean) {
    this.financialHealthIncludeCurrentMonth = value;
    localStorage.setItem('report7IncludeCurrentMonth', value.toString());
    setTimeout(() => this.setFinancialHealthDefaultPeriod());
  }

  generateReport() {
    if (this.reportInvalid) {
      return;
    }

    this.reportPanelExpanded = false;
    this.showReport = false;

    setTimeout(() => {
      this.reportType = this.selectedReportType;
      this.showReport = true;
    });
  }

  initialDateChanged(date: Date | null) {
    this.initialDateValue = date;
    this.persistDate('report4InitialDate', date);
  }

  finalDateChanged(date: Date | null) {
    this.finalDateValue = date;
    this.persistDate('report4FinalDate', date);
  }

  forecastInitialDateChanged(date: Date | null) {
    this.forecastInitialDateValue = date;
    this.persistDate('report6InitialDate', date);
  }

  forecastFinalDateChanged(date: Date | null) {
    this.forecastFinalDateValue = date;
    this.persistDate('report6FinalDate', date);
  }

  groupByCategoryChanged(groupByCategory: boolean) {
    this.groupByCategory = groupByCategory;
    localStorage.setItem('report3GroupByCategory', this.groupByCategory.toString());

    if (!this.groupByCategory) {
      this.showCategoryChart = false;
      localStorage.setItem('report3ShowCategoryChart', 'false');
    }
  }

  showCategoryChartChanged(showCategoryChart: boolean) {
    this.showCategoryChart = showCategoryChart;
    localStorage.setItem('report3ShowCategoryChart', this.showCategoryChart.toString());
  }

  showDisabledCardsChanged(showDisabledCards: boolean) {
    this.showDisabledCards = showDisabledCards;
    localStorage.setItem('report5ShowDisabledCards', this.showDisabledCards.toString());
    this.refreshCards();
  }

  onlyMyCardExpensesChanged(onlyMyCardExpenses: boolean) {
    this.onlyMyCardExpenses = onlyMyCardExpenses;
    localStorage.setItem('report5OnlyMyCardExpenses', this.onlyMyCardExpenses.toString());
  }

  groupByCardChanged(groupByCard: boolean) {
    this.groupByCard = groupByCard;
    localStorage.setItem('report5GroupByCard', this.groupByCard.toString());

    if (!this.groupByCard) {
      this.showCardChart = false;
      localStorage.setItem('report5ShowCardChart', 'false');
    }
  }

  showCardChartChanged(showCardChart: boolean) {
    this.showCardChart = showCardChart;
    localStorage.setItem('report5ShowCardChart', this.showCardChart.toString());
  }


  setFinancialHealthDefaultPeriod(): void {
    if (!this.reportInitialDatepicker || !this.reportFinalDatepicker) {
      return;
    }

    this.reportFinalDatepicker.setCurrentMonth();

    if (!this.financialHealthIncludeCurrentMonth) {
      this.reportFinalDatepicker.setPreviousMonth();
    }

    this.reportInitialDatepicker.setCurrentMonth();

    const monthsBack = this.financialHealthIncludeCurrentMonth ? 11 : 12;
    const initialDate = this.reportInitialDatepicker.date.value
      .clone()
      .subtract(monthsBack, 'M');

    this.reportInitialDatepicker.date.setValue(initialDate);
    this.reportInitialDatepicker.setMonthName();
  }

  private ensureFinancialHealthDefaultPeriod(): void {
    if (this.selectedReportType !== 7) {
      return;
    }

    const currentReference = this.toReference(new Date());
    const hasOnlyCurrentMonth =
      this.initialReference === currentReference &&
      this.finalReference === currentReference;

    if (!this.initialReference || !this.finalReference || hasOnlyCurrentMonth) {
      this.setFinancialHealthDefaultPeriod();
    }
  }

  private refreshCards() {
    this.cards = this.allCards.filter((card) => this.showDisabledCards || card.disabled !== true);

    if (this.cardId !== 0 && !this.cards.some((card) => card.id === this.cardId)) {
      this.cardId = 0;
      localStorage.setItem('lastSelectedCardReport', '0');
    }
  }

  private persistDate(key: string, date: Date | null): void {
    if (!date) {
      localStorage.removeItem(key);
      return;
    }

    localStorage.setItem(key, new Date(date as any).toISOString());
  }

  private toReference(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');

    return `${year}${month}`;
  }

  private readStoredNumber(
    key: string,
    defaultValue: number,
    allowedValues: number[]
  ): number {
    const storedValue = parseInt(localStorage.getItem(key) || '');

    return allowedValues.includes(storedValue)
      ? storedValue
      : defaultValue;
  }
}
