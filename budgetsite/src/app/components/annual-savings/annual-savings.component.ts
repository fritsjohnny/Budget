import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { finalize, forkJoin } from 'rxjs';
import { AnnualSavingsConsolidated, AnnualSavingsMonth, AnnualSavingsReport } from 'src/app/models/annual-savings.model';
import { AnnualSavingsService } from 'src/app/services/annual-savings/annual-savings.service';

@Component({
  selector: 'app-annual-savings',
  templateUrl: './annual-savings.component.html',
  styleUrls: ['./annual-savings.component.scss']
})
export class AnnualSavingsComponent implements OnInit {

  @ViewChild('annualGoalCalculationDialog') annualGoalCalculationDialog!: TemplateRef<any>;

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

  goalCalculationTitle: string = '';
  goalCalculationFormula: string = '';
  goalCalculationItems: { label: string, value: string }[] = [];
  goalCalculationResult: string = '';

  annualSavingsMonthlySimulation: { [reference: string]: number } = {};
  private annualSavingsCurrentMonthSimulation: { [reference: string]: number } = {};
  private annualSavingsOriginalMonthTotals: { [reference: string]: number | null } = {};
  private annualSavingsGeneralBalanceBase: number = 0;
  private annualSavingsRealGeneralBalanceBase: number = 0;

  constructor(
    private annualSavingsService: AnnualSavingsService,
    private dialog: MatDialog
  ) { }

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
          this.setAnnualSavingsReportSnapshot();
          this.loadAnnualMonthlySimulation();
          this.applyAnnualMonthlySimulation();

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

  annualMonthTotalChanged(row: AnnualSavingsMonth) {
    const value = this.normalizeNullableNumber(row.total);
    row.total = value;

    if (value === null) {
      delete this.annualSavingsMonthlySimulation[row.reference];
      delete this.annualSavingsCurrentMonthSimulation[row.reference];
    } else {
      this.annualSavingsMonthlySimulation[row.reference] = value;

      if (this.isCurrentReference(row.reference)) {
        this.annualSavingsCurrentMonthSimulation[row.reference] = value;
      }
    }

    this.saveAnnualMonthlySimulation();
    this.recalculateAnnualSavingsReport();
    this.calculateAnnualGoal();
  }

  canEditAnnualMonthTotal(row: AnnualSavingsMonth): boolean {
    return this.isCurrentReference(row.reference) || !this.hasAnnualMonthDatabaseValue(row);
  }

  private canSaveAnnualMonthSimulation(row: AnnualSavingsMonth): boolean {
    return this.canEditAnnualMonthTotal(row)
      && !this.isCurrentReference(row.reference)
      && !this.hasAnnualMonthDatabaseValue(row);
  }

  private setAnnualSavingsReportSnapshot() {
    this.annualSavingsOriginalMonthTotals = {};

    const reportTotal = this.normalizeNumber(this.report?.total);
    this.annualSavingsGeneralBalanceBase = this.normalizeNumber(this.report?.generalBalance) - reportTotal;
    this.annualSavingsRealGeneralBalanceBase = this.normalizeNumber(this.report?.realGeneralBalance) - reportTotal;

    this.report?.monthRows?.forEach(row => {
      this.annualSavingsOriginalMonthTotals[row.reference] = row.total;
    });
  }

  private loadAnnualMonthlySimulation() {
    this.annualSavingsMonthlySimulation = {};

    const storedSimulation = localStorage.getItem(this.getAnnualMonthlySimulationStorageKey());

    if (storedSimulation) {
      try {
        const storedValues = JSON.parse(storedSimulation);

        Object.keys(storedValues).forEach(reference => {
          const value = this.normalizeNullableNumber(storedValues[reference]);

          if (value !== null) {
            this.annualSavingsMonthlySimulation[reference] = value;
          }
        });
      } catch {
        localStorage.removeItem(this.getAnnualMonthlySimulationStorageKey());
      }
    }

    Object.keys(this.annualSavingsCurrentMonthSimulation).forEach(reference => {
      const value = this.normalizeNullableNumber(this.annualSavingsCurrentMonthSimulation[reference]);

      if (this.isCurrentReference(reference) && value !== null) {
        this.annualSavingsMonthlySimulation[reference] = value;
      }
    });
  }

  private saveAnnualMonthlySimulation() {
    const valuesToSave: { [reference: string]: number } = { ...this.annualSavingsMonthlySimulation };

    Object.keys(valuesToSave).forEach(reference => {
      if (this.isCurrentReference(reference)) {
        delete valuesToSave[reference];
        return;
      }

      const row = this.report?.monthRows?.find(monthRow => monthRow.reference === reference);

      if (row && !this.canSaveAnnualMonthSimulation(row)) {
        delete valuesToSave[reference];
        return;
      }

      const value = this.normalizeNullableNumber(valuesToSave[reference]);

      if (value === null) {
        delete valuesToSave[reference];
      } else {
        valuesToSave[reference] = value;
      }
    });

    if (Object.keys(valuesToSave).length > 0) {
      localStorage.setItem(this.getAnnualMonthlySimulationStorageKey(), JSON.stringify(valuesToSave));
    } else {
      localStorage.removeItem(this.getAnnualMonthlySimulationStorageKey());
    }
  }

  private applyAnnualMonthlySimulation() {
    if (!this.report?.monthRows) {
      return;
    }

    this.report.monthRows.forEach(row => {
      const originalTotal = this.annualSavingsOriginalMonthTotals[row.reference];
      row.total = originalTotal === undefined ? null : originalTotal;

      const simulationValue = this.normalizeNullableNumber(this.annualSavingsMonthlySimulation[row.reference]);

      if (simulationValue !== null && (this.isCurrentReference(row.reference) || !this.hasAnnualMonthDatabaseValue(row))) {
        row.total = simulationValue;
      }
    });

    this.saveAnnualMonthlySimulation();
    this.recalculateAnnualSavingsReport();
  }

  private recalculateAnnualSavingsReport() {
    if (!this.report?.monthRows) {
      return;
    }

    const rowsWithTotal = this.report.monthRows
      .map(row => this.normalizeNullableNumber(row.total))
      .filter((value): value is number => value !== null);

    this.report.total = rowsWithTotal.reduce((sum, value) => sum + value, 0);
    this.report.months = rowsWithTotal.length;
    this.report.average = this.report.months > 0 ? this.report.total / this.report.months : 0;

    this.recalculateAnnualSavingsBalances();
    this.recalculateQuarterAverages();
  }

  private recalculateAnnualSavingsBalances() {
    let generalBalance = this.annualSavingsGeneralBalanceBase;
    let realGeneralBalance = this.annualSavingsRealGeneralBalanceBase;

    this.report.monthRows.forEach(row => {
      const total = this.normalizeNullableNumber(row.total);

      if (total === null) {
        row.generalBalance = null;
        row.realGeneralBalance = null;
        return;
      }

      generalBalance += total;
      realGeneralBalance += total;

      row.generalBalance = generalBalance;
      row.realGeneralBalance = realGeneralBalance;
    });

    this.report.generalBalance = generalBalance;
    this.report.realGeneralBalance = realGeneralBalance;
  }

  private recalculateQuarterAverages() {
    const quarters = [1, 2, 3, 4];

    quarters.forEach(quarter => {
      const quarterRows = this.report.monthRows.filter(row => Math.ceil(row.month / 3) === quarter);

      if (!quarterRows.length) {
        return;
      }

      const quarterValues = quarterRows
        .map(row => this.normalizeNullableNumber(row.total))
        .filter((value): value is number => value !== null);

      const quarterTotal = quarterValues.reduce((sum, value) => sum + value, 0);
      const quarterAverage = quarterValues.length > 0 ? quarterTotal / quarterValues.length : null;

      quarterRows.forEach((row, index) => {
        row.showQuarterAverage = index === 0;
        row.quarterRowSpan = quarterRows.length;
        row.quarterAverage = index === 0 ? quarterAverage : null;
      });
    });
  }

  private hasAnnualMonthDatabaseValue(row: AnnualSavingsMonth): boolean {
    const originalTotal = this.annualSavingsOriginalMonthTotals[row.reference];
    return row.hasData === true || (originalTotal !== null && originalTotal !== undefined);
  }

  private isCurrentReference(reference: string): boolean {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentReference = `${currentDate.getFullYear()}${currentMonth < 10 ? '0' + currentMonth : currentMonth}`;

    return reference === currentReference;
  }

  private getAnnualMonthlySimulationStorageKey(): string {
    return `annualSavingsMonthlySimulation_${this.year}`;
  }

  private normalizeNullableNumber(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const numberValue = Number(value);
    return isNaN(numberValue) ? null : numberValue;
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

  openAnnualGoalCalculation(field: string) {
    this.setAnnualGoalCalculation(field);

    this.dialog.open(this.annualGoalCalculationDialog, {
      width: '95vw',
      maxWidth: '430px',
      autoFocus: false,
      panelClass: 'annual-goal-dialog-panel'
    });
  }

  private setAnnualGoalCalculation(field: string) {
    this.goalCalculationItems = [];

    switch (field) {
      case 'meta':
        this.goalCalculationTitle = 'Meta';
        this.goalCalculationFormula = 'Valor informado manualmente e salvo no localStorage por ano.';
        this.goalCalculationItems = [
          { label: 'Ano', value: this.year.toString() },
          { label: 'Chave localStorage', value: this.getAnnualGoalStorageKey() },
          { label: 'Valor salvo', value: this.formatCurrency(this.annualGoal) }
        ];
        this.goalCalculationResult = this.formatCurrency(this.annualGoal);
        break;

      case 'target':
        const previousRealGeneralBalance = this.getPreviousRealGeneralBalance();

        this.goalCalculationTitle = 'Alvo';
        this.goalCalculationFormula = 'Meta - Saldo Real anterior ao ano';
        this.goalCalculationItems = [
          { label: 'Meta', value: this.formatCurrency(this.annualGoal) },
          { label: 'Saldo Real anterior ao ano', value: this.formatCurrency(previousRealGeneralBalance) }
        ];
        this.goalCalculationResult = this.formatCurrency(this.annualGoalTarget);
        break;

      case 'remaining':
        const currentRealGeneralBalance = this.normalizeNumber(this.report?.realGeneralBalance);

        this.goalCalculationTitle = 'Restante';
        this.goalCalculationFormula = 'Meta - Saldo Real atual. Se o resultado for negativo, mostra 0.';
        this.goalCalculationItems = [
          { label: 'Meta', value: this.formatCurrency(this.annualGoal) },
          { label: 'Saldo Real atual', value: this.formatCurrency(currentRealGeneralBalance) },
          { label: 'Cálculo bruto', value: this.formatCurrency(this.annualGoal - currentRealGeneralBalance) }
        ];
        this.goalCalculationResult = this.formatCurrency(this.annualGoalRemaining);
        break;

      case 'monthlyAverage12Months':
        this.goalCalculationTitle = 'Média Mensal 12 meses';
        this.goalCalculationFormula = 'Alvo / 12';
        this.goalCalculationItems = [
          { label: 'Alvo', value: this.formatCurrency(this.annualGoalTarget) },
          { label: 'Meses do ano', value: '12' }
        ];
        this.goalCalculationResult = this.formatCurrency(this.annualGoalMonthlyAverage12Months);
        break;

      case 'remainingMonths':
        const elapsedMonths = this.report?.monthRows
          ?.filter(row => row.total !== null && row.total !== undefined)
          .length ?? 0;

        this.goalCalculationTitle = 'Meses Restantes';
        this.goalCalculationFormula = '12 - meses já considerados no relatório';
        this.goalCalculationItems = [
          { label: 'Meses do ano', value: '12' },
          { label: 'Meses considerados', value: elapsedMonths.toString() }
        ];
        this.goalCalculationResult = this.annualGoalRemainingMonths.toString();
        break;

      case 'remainingMonthsAverage':
        this.goalCalculationTitle = 'Média Mensal meses restante';
        this.goalCalculationFormula = 'Restante / Meses Restantes. Se Meses Restantes for 0, mostra 0.';
        this.goalCalculationItems = [
          { label: 'Restante', value: this.formatCurrency(this.annualGoalRemaining) },
          { label: 'Meses Restantes', value: this.annualGoalRemainingMonths.toString() }
        ];
        this.goalCalculationResult = this.formatCurrency(this.annualGoalRemainingMonthsAverage);
        break;
    }
  }
}
