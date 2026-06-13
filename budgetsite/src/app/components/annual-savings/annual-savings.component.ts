import { Component, OnInit } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { AnnualSavingsConsolidated, AnnualSavingsMonth, AnnualSavingsReport } from 'src/app/models/annual-savings.model';
import { AnnualSavingsService } from 'src/app/services/annual-savings/annual-savings.service';

@Component({
  selector: 'app-annual-savings',
  templateUrl: './annual-savings.component.html',
  styleUrls: ['./annual-savings.component.scss']
})
export class AnnualSavingsComponent implements OnInit {

  year: number = new Date().getFullYear();
  report!: AnnualSavingsReport;
  consolidated: AnnualSavingsConsolidated[] = [];
  annualSavingsPanelExpanded: boolean = false;
  showProgress: boolean = false;
  lastUpdated?: Date;
  includeCurrentMonth: boolean = true;
  includeNextMonths: boolean = false;
  includeCurrentYear: boolean = true;
  includeNextYears: boolean = false;

  annualGoal: number = 0;
  annualGoalTarget: number = 0;
  annualGoalRemaining: number = 0;
  annualGoalMonthlyAverage12Months: number = 0;
  annualGoalRemainingMonths: number = 0;
  annualGoalRemainingMonthsAverage: number = 0;

  previousYearForecastBalance: number = 0;
  previousYearRealBalance: number = 0;
  currentYearForecastBalance: number = 0;
  currentYearRealBalance: number = 0;

  constructor(private annualSavingsService: AnnualSavingsService) { }

  ngOnInit(): void {
    const storedYear = localStorage.getItem('annualSavingsYear');

    if (storedYear) {
      this.year = parseInt(storedYear);
    }

    this.annualSavingsPanelExpanded = localStorage.getItem('annualSavingsPanelExpanded') === 'true';

    this.loadAnnualGoal();
    this.refresh();
  }

  refresh() {
    if (!this.year) {
      this.year = new Date().getFullYear();
    }

    localStorage.setItem('annualSavingsYear', this.year.toString());
    this.loadAnnualGoal();

    this.showProgress = true;

    forkJoin({
      report: this.annualSavingsService.getByYear(this.year, this.includeCurrentMonth, this.includeNextMonths),
      consolidated: this.annualSavingsService.getConsolidated(this.includeCurrentYear, this.includeNextYears, this.includeCurrentMonth, this.includeNextMonths),
      previousYearEndReport: this.annualSavingsService.getByYear(this.year - 1, true, true),
      currentYearEndReport: this.annualSavingsService.getByYear(this.year, this.includeCurrentMonth, false)
    })
      .pipe(finalize(() => this.showProgress = false))
      .subscribe({
        next: ({ report, consolidated, previousYearEndReport, currentYearEndReport }) => {
          this.report = report;
          this.consolidated = consolidated;
          this.setAnnualBalanceSummary(previousYearEndReport, currentYearEndReport);
          this.lastUpdated = new Date();
          this.calculateAnnualGoal();
        }
      });
  }

  annualGoalChanged() {
    this.annualGoal = this.normalizeNumber(this.annualGoal);
    localStorage.setItem(this.getAnnualGoalStorageKey(), this.annualGoal.toString());
    this.calculateAnnualGoal();
  }

  private loadAnnualGoal() {
    const storedGoal = localStorage.getItem(this.getAnnualGoalStorageKey());
    this.annualGoal = storedGoal ? this.normalizeNumber(Number(storedGoal)) : 0;
    this.calculateAnnualGoal();
  }

  private setAnnualBalanceSummary(previousYearEndReport: AnnualSavingsReport, currentYearEndReport: AnnualSavingsReport) {
    this.previousYearForecastBalance = this.normalizeNumber(previousYearEndReport?.generalBalance);
    this.previousYearRealBalance = this.normalizeNumber(previousYearEndReport?.realGeneralBalance);
    this.currentYearForecastBalance = this.normalizeNumber(currentYearEndReport?.generalBalance);
    this.currentYearRealBalance = this.normalizeNumber(currentYearEndReport?.realGeneralBalance);
  }

  getPreviousYearEndDateLabel(): string {
    return `31/12/${this.year - 1}`;
  }

  getCurrentYearEndDateLabel(): string {
    return `31/12/${this.year}`;
  }

  private calculateAnnualGoal() {
    const previousRealGeneralBalance = this.getPreviousRealGeneralBalance();
    const currentRealGeneralBalance = this.normalizeNumber(this.report?.realGeneralBalance);

    this.annualGoalTarget = this.annualGoal - previousRealGeneralBalance;

    this.annualGoalRemaining = this.annualGoal - currentRealGeneralBalance > 0
      ? this.annualGoal - currentRealGeneralBalance
      : 0;

    this.annualGoalMonthlyAverage12Months = this.annualGoalTarget / 12;
    this.annualGoalRemainingMonths = this.getAnnualGoalRemainingMonths();

    this.annualGoalRemainingMonthsAverage = this.annualGoalRemainingMonths > 0
      ? this.annualGoalRemaining / this.annualGoalRemainingMonths
      : 0;
  }

  private getPreviousRealGeneralBalance(): number {
    if (!this.report) {
      return 0;
    }

    return this.normalizeNumber(this.report.generalBalance) - this.normalizeNumber(this.report.total);
  }

  private getAnnualGoalRemainingMonths(): number {
    const elapsedMonths = this.report?.monthRows
      ?.filter(row => row.total !== null && row.total !== undefined)
      .length ?? 0;

    return Math.max(12 - elapsedMonths, 0);
  }

  private getAnnualGoalStorageKey(): string {
    return `annualSavingsGoal_${this.year}`;
  }

  private normalizeNumber(value: number | null | undefined): number {
    const numberValue = Number(value);
    return isNaN(numberValue) ? 0 : numberValue;
  }

  setPreviousYear() {
    this.year--;
    this.refresh();
  }

  setNextYear() {
    this.year++;
    this.refresh();
  }

  setCurrentYear() {
    this.year = new Date().getFullYear();
    this.refresh();
  }

  yearChanged() {
    this.refresh();
  }

  filtersChanged() {
    this.refresh();
  }

  annualSavingsPanelClosed() {
    localStorage.setItem('annualSavingsPanelExpanded', 'false');
  }

  annualSavingsPanelOpened() {
    localStorage.setItem('annualSavingsPanelExpanded', 'true');
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  getValueClass(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    return value < 0 ? 'negative' : 'positive';
  }

  trackMonth(index: number, row: AnnualSavingsMonth): string {
    return row.reference;
  }

  trackConsolidated(index: number, row: AnnualSavingsConsolidated): string {
    return row.label;
  }
}
