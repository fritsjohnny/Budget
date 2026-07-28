import { Component, DoCheck, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DATE_FORMATS } from '@angular/material/core';
import { MatDatepicker } from '@angular/material/datepicker';
import { MatSort } from '@angular/material/sort';
import * as _moment from 'moment';
import { CardsPostingsDTO } from 'src/app/models/cardspostingsdto.model';
import { ExpensesByCategories } from 'src/app/models/expensesbycategories';
import { default as _rollupMoment, Moment } from 'moment';
import { MY_FORMATS } from 'src/app/shared/datepicker/datepicker.component';

const moment = _rollupMoment || _moment;

@Component({
  selector: 'app-budget-modern-layout',
  templateUrl: './budget-modern-layout.component.html',
  styleUrls: ['./budget-modern-layout.component.scss'],
  providers: [{ provide: MAT_DATE_FORMATS, useValue: MY_FORMATS }],
})
export class BudgetModernLayoutComponent implements OnInit, DoCheck {
  @Input() context!: any;

  date = new FormControl(moment());
  pullDistance = 0;
  pullReady = false;
  isPullRefreshing = false;

  private synchronizedReference = '';
  private peopleSort?: MatSort;
  private categoriesSort?: MatSort;
  private pullStartY?: number;
  private pullTracking = false;
  private readonly pullRefreshThreshold = 58;
  private readonly maxPullDistance = 104;
  private readonly portugueseCollator = new Intl.Collator('pt-BR', {
    usage: 'sort',
    sensitivity: 'base',
    numeric: true,
  });

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  @ViewChild('modernPeopleSort')
  set modernPeopleSort(sort: MatSort | undefined) {
    this.peopleSort = sort;
    this.bindModernSorts();
  }

  @ViewChild('modernCategoriesSort')
  set modernCategoriesSort(sort: MatSort | undefined) {
    this.categoriesSort = sort;
    this.bindModernSorts();
  }

  ngOnInit(): void {
  }

  onReferenceChange(reference: string): void {
    const monthIndex = Number(reference.substring(4, 6)) - 1;
    const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' })
      .format(new Date(2000, monthIndex, 1));

    this.context.monthName = this.capitalize(monthName);
    this.context.referenceChanges(reference);
  }

  ngDoCheck(): void {
    this.bindModernSorts();

    if (this.isPullRefreshing && !this.context?.isBudgetLoading) {
      this.finishPullRefresh();
    }

    const contextReference = this.context?.reference as string | undefined;

    if (!contextReference || !/^\d{6}$/.test(contextReference)) return;
    if (contextReference === this.synchronizedReference) return;

    const referenceDate = moment(contextReference, 'YYYYMM', true);

    if (!referenceDate.isValid()) return;

    this.date.setValue(referenceDate);
    this.synchronizedReference = contextReference;
  }

  get referenceTitle(): string {
    return this.date.value.format('MMMM YYYY').toLocaleUpperCase('pt-BR');
  }

  get referenceHead(): string {
    return this.date.value.format('MM/YYYY');
  }

  get previousMonthName(): string {
    return this.capitalize(this.date.value.clone().subtract(1, 'month').format('MMMM'));
  }

  get nextMonthName(): string {
    return this.capitalize(this.date.value.clone().add(1, 'month').format('MMMM'));
  }

  get isCurrentReference(): boolean {
    return this.date.value.format('YYYYMM') === moment().format('YYYYMM');
  }

  get provisionedCategories(): any[] {
    const expenses = this.context?.expensesNoFilter ?? this.context?.expenses ?? [];
    const categories = this.context?.expensesByCategories ?? this.context?.dataSourceCategories?.data ?? [];
    const addedCategories = new Set<string>();

    return expenses
      .filter((expense: any) => Number(expense?.expectedValue ?? 0) > 0)
      .map((expense: any) => {
        const categoryId = Number(expense?.categoryId ?? 0);
        const categoryName = String(expense?.category ?? expense?.description ?? '').trim();
        const normalizedCategoryName = this.normalizeCategoryName(categoryName);
        const category = categories.find((item: any) => {
          if (categoryId > 0 && Number(item?.id ?? 0) === categoryId) return true;

          return this.normalizeCategoryName(item?.category) === normalizedCategoryName;
        });
        const categoryKey = categoryId > 0
          ? `id:${categoryId}`
          : `name:${normalizedCategoryName}`;

        return {
          id: expense?.id,
          key: categoryKey,
          description: category?.category ?? categoryName,
          amount: Number(category?.amount ?? 0),
        };
      })
      .filter((category: any) => {
        if (!category.key || addedCategories.has(category.key)) return false;

        addedCategories.add(category.key);
        return true;
      });
  }

  get pullRefreshLabel(): string {
    if (this.isPullRefreshing) return 'Atualizando orçamento...';
    if (this.pullReady) return 'Solte para atualizar';

    return 'Arraste para atualizar';
  }

  onPullStart(event: TouchEvent): void {
    if (!this.isMobileViewport() || this.context?.isBudgetLoading || !this.isAtScrollTop(event)) return;
    if (event.touches.length !== 1) return;

    const touch = event.touches.item(0);

    if (!touch) return;

    this.pullStartY = touch.clientY;
    this.pullTracking = true;
    this.pullDistance = 0;
    this.pullReady = false;
  }

  onPullMove(event: TouchEvent): void {
    if (!this.pullTracking || this.pullStartY === undefined) return;

    const touch = event.touches.item(0);

    if (!touch || !this.isAtScrollTop(event)) {
      this.cancelPull();
      return;
    }

    const delta = touch.clientY - this.pullStartY;

    if (delta <= 0) {
      this.cancelPull();
      return;
    }

    event.preventDefault();

    this.pullDistance = Math.min(this.maxPullDistance, delta * 0.55);
    this.pullReady = this.pullDistance >= this.pullRefreshThreshold;
  }

  onPullEnd(): void {
    if (!this.pullTracking) return;

    const shouldRefresh = this.pullReady && !this.context?.isBudgetLoading;

    this.pullTracking = false;
    this.pullStartY = undefined;
    this.pullReady = false;

    if (!shouldRefresh) {
      this.pullDistance = 0;
      return;
    }

    this.isPullRefreshing = true;
    this.pullDistance = this.pullRefreshThreshold;
    this.context.refresh();
  }

  onPullCancel(): void {
    this.cancelPull();
  }

  chosenYearHandler(normalizedYear: Moment): void {
    const selectedDate = this.date.value.clone();
    selectedDate.year(normalizedYear.year());
    this.date.setValue(selectedDate);
  }

  chosenMonthHandler(normalizedMonth: Moment, datepicker: MatDatepicker<Moment>): void {
    const selectedDate = this.date.value.clone();
    selectedDate.month(normalizedMonth.month());
    this.date.setValue(selectedDate);
    datepicker.close();
    this.emitReference();
  }

  setPreviousMonth(): void {
    this.date.setValue(this.date.value.clone().subtract(1, 'month'));
    this.emitReference();
  }

  setNextMonth(): void {
    this.date.setValue(this.date.value.clone().add(1, 'month'));
    this.emitReference();
  }

  setCurrentMonth(): void {
    this.date.setValue(moment());
    this.emitReference();
  }

  getExpenseStatus(expense: any): string {
    if (Number(expense?.remaining ?? 0) <= 0 && Number(expense?.toPay ?? 0) > 0) return 'Pago';
    if (Number(expense?.expectedValue ?? 0) > 0 && Number(expense?.toPay ?? 0) <= 0) return 'Provisionado';
    if (expense?.overdue) return 'Vencido';
    if (expense?.duetoday) return 'Vence hoje';

    return 'Pendente';
  }

  getExpenseStatusClass(expense: any): string {
    const status = this.getExpenseStatus(expense);

    if (status === 'Pago') return 'status-paid';
    if (status === 'Provisionado') return 'status-provisioned';
    if (status === 'Vence hoje') return 'status-today';
    if (status === 'Vencido') return 'status-overdue';

    return 'status-pending';
  }

  getExpenseStatusIcon(expense: any): string {
    const status = this.getExpenseStatus(expense);

    if (status === 'Pago') return 'check_circle_outline';
    if (status === 'Provisionado') return 'event_available';
    if (status === 'Vence hoje') return 'notification_important';
    if (status === 'Vencido') return 'error_outline';

    return 'schedule';
  }

  trackById(index: number, item: any): number {
    return item?.id ?? index;
  }

  formatPercentage(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';

    return value.toFixed(2).replace('.', ',') + '%';
  }

  private isMobileViewport(): boolean {
    return window.matchMedia('(max-width: 600px)').matches;
  }

  private isAtScrollTop(event?: TouchEvent): boolean {
    let element: Element | null =
      event?.target instanceof Element
        ? event.target
        : this.elementRef.nativeElement;

    while (element && element !== document.body) {
      const style = window.getComputedStyle(element);
      const canScrollVertically =
        /(auto|scroll|overlay)/.test(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 1;

      if (canScrollVertically && element.scrollTop > 0) return false;

      element = element.parentElement;
    }

    return window.scrollY <= 0 &&
      document.documentElement.scrollTop <= 0 &&
      document.body.scrollTop <= 0;
  }

  private cancelPull(): void {
    this.pullTracking = false;
    this.pullStartY = undefined;
    this.pullDistance = 0;
    this.pullReady = false;
  }

  private finishPullRefresh(): void {
    this.isPullRefreshing = false;
    this.pullDistance = 0;
  }

  private bindModernSorts(): void {
    if (this.peopleSort && this.context?.dataSourcePeople && this.context.dataSourcePeople.sort !== this.peopleSort) {
      this.context.dataSourcePeople.sortData = (
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

      this.context.dataSourcePeople.sort = this.peopleSort;
    }

    if (this.categoriesSort && this.context?.dataSourceCategories && this.context.dataSourceCategories.sort !== this.categoriesSort) {
      this.context.dataSourceCategories.sortData = (
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

      this.context.dataSourceCategories.sort = this.categoriesSort;
    }
  }

  private emitReference(): void {
    const reference = this.date.value.format('YYYYMM');

    this.synchronizedReference = reference;
    localStorage.setItem('budgetDate', this.date.value.toISOString());

    if (!this.context) return;

    this.context.monthName = this.capitalize(this.date.value.format('MMMM'));
    this.context.referenceChanges(reference);
  }

  private normalizeCategoryName(value: unknown): string {
    return String(value ?? '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR');
  }

  private capitalize(value: string): string {
    if (!value) return value;

    return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1);
  }
}
