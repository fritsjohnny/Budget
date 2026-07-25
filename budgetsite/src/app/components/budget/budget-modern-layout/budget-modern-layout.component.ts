import { Component, DoCheck, Input, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DATE_FORMATS } from '@angular/material/core';
import { MatDatepicker } from '@angular/material/datepicker';
import { MatSort } from '@angular/material/sort';
import * as _moment from 'moment';
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
  private synchronizedReference = '';
  private peopleSort?: MatSort;
  private categoriesSort?: MatSort;

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
    moment.locale('pt-BR');

    const contextReference = this.context?.reference as string | undefined;
    const storedDate = localStorage.getItem('budgetDate');

    if (contextReference && /^\d{6}$/.test(contextReference)) {
      this.date.setValue(moment(contextReference, 'YYYYMM', true));
    } else if (storedDate && moment(storedDate).isValid()) {
      this.date.setValue(moment(storedDate));
    }

    this.emitReference();
  }

  ngDoCheck(): void {
    this.bindModernSorts();

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

  get provisionedExpenses(): any[] {
    const expenses = this.context?.expensesNoFilter ?? this.context?.expenses ?? [];

    return expenses.filter((expense: any) => Number(expense?.expectedValue ?? 0) > 0);
  }

  get visibleProvisionedExpenses(): any[] {
    return this.provisionedExpenses.slice(0, 3);
  }

  get remainingProvisionedExpenses(): number {
    return Math.max(0, this.provisionedExpenses.length - this.visibleProvisionedExpenses.length);
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

  private bindModernSorts(): void {
    if (this.peopleSort && this.context?.dataSourcePeople && this.context.dataSourcePeople.sort !== this.peopleSort) {
      this.context.dataSourcePeople.sort = this.peopleSort;
    }

    if (this.categoriesSort && this.context?.dataSourceCategories && this.context.dataSourceCategories.sort !== this.categoriesSort) {
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

  private capitalize(value: string): string {
    if (!value) return value;

    return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1);
  }
}
