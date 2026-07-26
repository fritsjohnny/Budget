import { Component, DoCheck, ElementRef, Input, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DATE_FORMATS } from '@angular/material/core';
import { MatDatepicker } from '@angular/material/datepicker';
import * as _moment from 'moment';
import { default as _rollupMoment, Moment } from 'moment';
import { MY_FORMATS } from 'src/app/shared/datepicker/datepicker.component';

const moment = _rollupMoment || _moment;

@Component({
  selector: 'app-summary-modern-layout',
  templateUrl: './summary-modern-layout.component.html',
  styleUrls: ['./summary-modern-layout.component.scss'],
  providers: [{ provide: MAT_DATE_FORMATS, useValue: MY_FORMATS }],
})
export class SummaryModernLayoutComponent implements OnInit, DoCheck {
  @Input() context!: any;

  date = new FormControl(moment());
  pullDistance = 0;
  pullReady = false;
  isPullRefreshing = false;

  private synchronizedReference = '';
  private pullStartY?: number;
  private pullTracking = false;
  private readonly pullRefreshThreshold = 58;
  private readonly maxPullDistance = 104;

  constructor(private elementRef: ElementRef<HTMLElement>) {}

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
    if (this.isPullRefreshing && !this.isLoading) {
      this.finishPullRefresh();
    }
  }

  get isLoading(): boolean {
    return !this.context?.hideAccountsSummaryProgress || !this.context?.hideTotalsAccountsSummaryProgress;
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

  get realForecastBalance(): number {
    const totals = this.context?.totalsAccountsSummary;

    return (totals?.availableBalance ?? 0) + (totals?.toReceive ?? 0) - (totals?.toPay ?? 0);
  }

  get previousToPayDisplay(): number {
    return (this.context?.totalsAccountsSummary?.previousToPay ?? 0) * -1;
  }

  get pullRefreshLabel(): string {
    if (this.isPullRefreshing) return 'Atualizando saldos...';
    if (this.pullReady) return 'Solte para atualizar';

    return 'Arraste para atualizar';
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

  onPullStart(event: TouchEvent): void {
    if (!this.isMobileViewport() || this.isLoading || !this.isAtScrollTop()) return;
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

    if (!touch || !this.isAtScrollTop()) {
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

    const shouldRefresh = this.pullReady && !this.isLoading;

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

  trackByPosition(index: number, item: any): number {
    return item?.position ?? index;
  }

  private isMobileViewport(): boolean {
    return window.matchMedia('(max-width: 600px)').matches;
  }

  private isAtScrollTop(): boolean {
    const host = this.elementRef.nativeElement;
    const scrollContainer = host.closest('.mat-sidenav-content, .mat-drawer-content') as HTMLElement | null;

    if (scrollContainer) return scrollContainer.scrollTop <= 0;

    return window.scrollY <= 0 && document.documentElement.scrollTop <= 0 && document.body.scrollTop <= 0;
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

  private emitReference(): void {
    const reference = this.date.value.format('YYYYMM');

    this.synchronizedReference = reference;
    localStorage.setItem('summaryDate', this.date.value.toISOString());

    if (!this.context) return;

    this.context.monthName = this.capitalize(this.date.value.format('MMMM'));
    this.context.referenceChanges(reference);
  }

  private capitalize(value: string): string {
    if (!value) return value;

    return value.charAt(0).toLocaleUpperCase('pt-BR') + value.slice(1);
  }
}
