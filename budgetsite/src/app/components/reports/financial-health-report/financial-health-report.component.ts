import { AfterViewInit, Component, Input } from '@angular/core';
import { finalize } from 'rxjs';
import {
  FinancialHealthAccount,
  FinancialHealthCategory,
  FinancialHealthFutureProjection,
  FinancialHealthInsight,
  FinancialHealthLegend,
  FinancialHealthMonthly,
  FinancialHealthPotentialDuplicate,
  FinancialHealthReport,
  FinancialHealthScoreComponent
} from 'src/app/models/financial-health-report.model';
import { FinancialHealthService } from 'src/app/services/financial-health/financial-health.service';

interface FinancialHealthChartColors {
  text: string;
  grid: string;
  income: string;
  expenses: string;
  surplus: string;
  yields: string;
  balance: string;
  positive: string;
  warning: string;
  danger: string;
  info: string;
  track: string;
  palette: string[];
}

@Component({
  selector: 'app-financial-health-report',
  templateUrl: './financial-health-report.component.html',
  styleUrls: ['./financial-health-report.component.scss']
})
export class FinancialHealthReportComponent implements AfterViewInit {
  @Input() initialReference: string | undefined;
  @Input() finalReference: string | undefined;
  @Input() reserveTargetMonths: number = 9;
  @Input() futureMonths: number = 12;
  @Input() includeCurrentMonth: boolean = false;

  showProgress = false;
  report: FinancialHealthReport | null = null;

  scoreChartType: any = 'doughnut';
  scoreChartData: any = { labels: [], datasets: [] };
  scoreChartOptions: any = {};

  monthlyChartType: any = 'bar';
  monthlyChartData: any = { labels: [], datasets: [] };
  monthlyChartOptions: any = {};

  balanceChartType: any = 'line';
  balanceChartData: any = { labels: [], datasets: [] };
  balanceChartOptions: any = {};

  institutionChartType: any = 'doughnut';
  institutionChartData: any = { labels: [], datasets: [] };
  institutionChartOptions: any = {};

  categoryChartType: any = 'bar';
  categoryChartData: any = { labels: [], datasets: [] };
  categoryChartOptions: any = {};

  futureChartType: any = 'bar';
  futureChartData: any = { labels: [], datasets: [] };
  futureChartOptions: any = {};

  installmentChartType: any = 'bar';
  installmentChartData: any = { labels: [], datasets: [] };
  installmentChartOptions: any = {};

  constructor(private financialHealthService: FinancialHealthService) { }

  ngAfterViewInit(): void {
    this.getReport();
  }

  getReport(): void {
    if (!this.initialReference || !this.finalReference) {
      return;
    }

    this.showProgress = true;

    this.financialHealthService
      .getReport(
        this.initialReference,
        this.finalReference,
        this.reserveTargetMonths,
        this.futureMonths,
        this.includeCurrentMonth
      )
      .pipe(finalize(() => this.showProgress = false))
      .subscribe({
        next: report => {
          this.report = report;
          this.buildCharts(report);
        },
        error: () => {
          this.report = null;
          this.clearCharts();
        }
      });
  }

  getReserveProgress(report: FinancialHealthReport): number {
    if (report.summary.reserveTargetMonths <= 0) {
      return 0;
    }

    return Math.min(
      report.summary.reserveCoverageMonths / report.summary.reserveTargetMonths * 100,
      100
    );
  }

  getScoreClass(score: number): string {
    if (score >= 85) {
      return 'score-excellent';
    }

    if (score >= 70) {
      return 'score-healthy';
    }

    if (score >= 50) {
      return 'score-warning';
    }

    return 'score-fragile';
  }

  getValueClass(value: number | null | undefined): string {
    if (value === null || value === undefined || value === 0) {
      return '';
    }

    return value > 0 ? 'positive-value' : 'negative-value';
  }

  getChangeClass(value: number | null | undefined, lowerIsBetter: boolean = false): string {
    if (value === null || value === undefined || value === 0) {
      return '';
    }

    const positive = lowerIsBetter ? value < 0 : value > 0;
    return positive ? 'positive-value' : 'negative-value';
  }

  getInsightClass(insight: FinancialHealthInsight): string {
    return `insight-${insight.severity}`;
  }

  formatCurrency(value: number | null | undefined): string {
    const normalizedValue = Number(value ?? 0);

    return normalizedValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    return `${Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`;
  }

  formatSignedPercent(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    const normalizedValue = Number(value);
    const signal = normalizedValue > 0 ? '+' : '';

    return `${signal}${normalizedValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}%`;
  }

  formatSignedPoints(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '-';
    }

    const normalizedValue = Number(value);
    const signal = normalizedValue > 0 ? '+' : '';

    return `${signal}${normalizedValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} p.p.`;
  }

  formatReference(reference: string): string {
    if (!reference || reference.length !== 6) {
      return reference;
    }

    return `${reference.substring(4, 6)}/${reference.substring(0, 4)}`;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '-';
    }

    return new Date(value).toLocaleDateString('pt-BR');
  }

  trackMonthly(index: number, row: FinancialHealthMonthly): string {
    return row.reference;
  }

  trackAccount(index: number, row: FinancialHealthAccount): number {
    return row.id;
  }

  trackCategory(index: number, row: FinancialHealthCategory): string {
    return `${row.categoryId ?? 0}-${row.name}`;
  }

  trackFuture(index: number, row: FinancialHealthFutureProjection): string {
    return row.reference;
  }

  trackInsight(index: number, row: FinancialHealthInsight): string {
    return `${row.priority}-${row.title}`;
  }

  trackScore(index: number, row: FinancialHealthScoreComponent): string {
    return row.name;
  }

  trackDuplicate(index: number, row: FinancialHealthPotentialDuplicate): string {
    return `${row.source}-${row.reference}-${row.description}-${index}`;
  }

  trackLegend(index: number, row: FinancialHealthLegend): string {
    return row.title;
  }

  private buildCharts(report: FinancialHealthReport): void {
    const colors = this.getChartColors();
    const scoreColor = this.getScoreColor(report.score, colors);

    this.scoreChartData = {
      labels: ['Pontuação', 'Distância para 100'],
      datasets: [
        {
          data: [report.score, Math.max(100 - report.score, 0)],
          backgroundColor: [scoreColor, colors.track],
          borderWidth: 0,
          hoverOffset: 0
        }
      ]
    };

    this.scoreChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '74%',
      rotation: -90,
      circumference: 180,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      }
    };

    const monthlyLabels = report.monthlyEvolution.map(month => month.label);

    this.monthlyChartData = {
      labels: monthlyLabels,
      datasets: [
        {
          type: 'bar',
          label: 'Receitas',
          data: report.monthlyEvolution.map(month => month.income),
          backgroundColor: colors.income,
          borderColor: colors.income,
          borderWidth: 1,
          order: 2
        },
        {
          type: 'bar',
          label: 'Despesas',
          data: report.monthlyEvolution.map(month => month.expenses),
          backgroundColor: colors.expenses,
          borderColor: colors.expenses,
          borderWidth: 1,
          order: 2
        },
        {
          type: 'line',
          label: 'Resultado',
          data: report.monthlyEvolution.map(month => month.surplus),
          borderColor: colors.surplus,
          backgroundColor: colors.surplus,
          pointBackgroundColor: colors.surplus,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.25,
          fill: false,
          order: 1
        }
      ]
    };

    this.monthlyChartOptions = this.buildCurrencyChartOptions(colors, false, false);

    this.balanceChartData = {
      labels: monthlyLabels,
      datasets: [
        {
          label: 'Saldo acumulado',
          data: report.monthlyEvolution.map(month => month.closingBalance),
          borderColor: colors.balance,
          backgroundColor: this.withOpacity(colors.balance, 0.16),
          pointBackgroundColor: colors.balance,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.25,
          fill: true
        },
        {
          label: 'Variação de caixa',
          data: report.monthlyEvolution.map(month => month.netCashChange),
          borderColor: colors.info,
          backgroundColor: colors.info,
          pointBackgroundColor: colors.info,
          pointRadius: 3,
          borderDash: [6, 4],
          tension: 0.2,
          fill: false
        }
      ]
    };

    this.balanceChartOptions = this.buildCurrencyChartOptions(colors, false, false);

    this.institutionChartData = {
      labels: report.institutions.map(institution => institution.name),
      datasets: [
        {
          data: report.institutions.map(institution => institution.balance),
          backgroundColor: report.institutions.map(
            (_, index) => colors.palette[index % colors.palette.length]
          ),
          borderWidth: 1,
          borderColor: colors.grid
        }
      ]
    };

    this.institutionChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: colors.text,
            usePointStyle: true,
            padding: 14
          }
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const institution = report.institutions[context.dataIndex];
              return `${institution.name}: ${this.formatCurrency(institution.balance)} (${this.formatPercent(institution.share)})`;
            }
          }
        }
      }
    };

    const topCategories = report.categories.slice(0, 10);

    this.categoryChartData = {
      labels: topCategories.map(category => category.name),
      datasets: [
        {
          label: 'Valor',
          data: topCategories.map(category => category.amount),
          backgroundColor: topCategories.map(
            (_, index) => colors.palette[index % colors.palette.length]
          ),
          borderWidth: 0
        }
      ]
    };

    this.categoryChartOptions = this.buildCurrencyChartOptions(colors, true, true);

    this.futureChartData = {
      labels: report.futureProjection.map(month => month.label),
      datasets: [
        {
          type: 'bar',
          label: 'Receitas previstas',
          data: report.futureProjection.map(month => month.income),
          backgroundColor: colors.income,
          borderColor: colors.income,
          borderWidth: 1,
          order: 2
        },
        {
          type: 'bar',
          label: 'Despesas previstas',
          data: report.futureProjection.map(month => month.expenses),
          backgroundColor: colors.expenses,
          borderColor: colors.expenses,
          borderWidth: 1,
          order: 2
        },
        {
          type: 'line',
          label: 'Resultado previsto',
          data: report.futureProjection.map(month => month.surplus),
          borderColor: colors.surplus,
          backgroundColor: colors.surplus,
          pointBackgroundColor: colors.surplus,
          pointRadius: 4,
          tension: 0.25,
          fill: false,
          order: 1
        }
      ]
    };

    this.futureChartOptions = this.buildCurrencyChartOptions(colors, false, false);

    this.installmentChartData = {
      labels: report.futureProjection.map(month => month.label),
      datasets: [
        {
          label: 'Cartões',
          data: report.futureProjection.map(month => month.cardInstallments),
          backgroundColor: colors.warning,
          borderColor: colors.warning,
          borderWidth: 1,
          stack: 'installments'
        },
        {
          label: 'Despesas diretas',
          data: report.futureProjection.map(month => month.directInstallments),
          backgroundColor: colors.info,
          borderColor: colors.info,
          borderWidth: 1,
          stack: 'installments'
        }
      ]
    };

    this.installmentChartOptions = this.buildCurrencyChartOptions(colors, false, false, true);
  }

  private clearCharts(): void {
    this.scoreChartData = { labels: [], datasets: [] };
    this.monthlyChartData = { labels: [], datasets: [] };
    this.balanceChartData = { labels: [], datasets: [] };
    this.institutionChartData = { labels: [], datasets: [] };
    this.categoryChartData = { labels: [], datasets: [] };
    this.futureChartData = { labels: [], datasets: [] };
    this.installmentChartData = { labels: [], datasets: [] };
  }

  private buildCurrencyChartOptions(
    colors: FinancialHealthChartColors,
    horizontal: boolean,
    hideLegend: boolean,
    stacked: boolean = false
  ): any {
    const valueAxis = {
      beginAtZero: true,
      stacked,
      ticks: {
        color: colors.text,
        callback: (value: any) => Number(value).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          maximumFractionDigits: 0
        })
      },
      grid: {
        color: colors.grid
      }
    };

    const labelAxis = {
      stacked,
      ticks: {
        color: colors.text,
        autoSkip: !horizontal,
        maxTicksLimit: horizontal ? undefined : 12,
        maxRotation: horizontal ? 0 : 45,
        minRotation: 0
      },
      grid: {
        color: colors.grid
      }
    };

    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? 'y' : 'x',
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: !hideLegend,
          position: 'bottom',
          labels: {
            color: colors.text,
            usePointStyle: true,
            padding: 14
          }
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = Number(context.raw ?? 0);
              return `${context.dataset.label}: ${this.formatCurrency(value)}`;
            }
          }
        }
      },
      scales: horizontal
        ? {
          x: valueAxis,
          y: labelAxis
        }
        : {
          x: labelAxis,
          y: valueAxis
        }
    };
  }

  private getChartColors(): FinancialHealthChartColors {
    const isDarkTheme =
      document.documentElement.classList.contains('dark-theme') ||
      document.body.classList.contains('dark-theme');

    return isDarkTheme
      ? {
        text: '#ffffff',
        grid: 'rgba(255, 255, 255, 0.14)',
        income: '#76d7a6',
        expenses: '#ff8a80',
        surplus: '#ffca6b',
        yields: '#ffd54f',
        balance: '#b9a7ff',
        positive: '#76d7a6',
        warning: '#ffca6b',
        danger: '#ff8a80',
        info: '#80c8ff',
        track: 'rgba(255, 255, 255, 0.13)',
        palette: [
          '#80c8ff',
          '#ffca6b',
          '#76d7a6',
          '#b9a7ff',
          '#ff8a80',
          '#80cbc4',
          '#f48fb1',
          '#ce93d8',
          '#90caf9',
          '#a5d6a7'
        ]
      }
      : {
        text: '#303030',
        grid: 'rgba(0, 0, 0, 0.11)',
        income: '#2e7d32',
        expenses: '#d32f2f',
        surplus: '#3f51b5',
        yields: '#f9a825',
        balance: '#673ab7',
        positive: '#2e7d32',
        warning: '#ed6c02',
        danger: '#d32f2f',
        info: '#1976d2',
        track: 'rgba(0, 0, 0, 0.09)',
        palette: [
          '#1976d2',
          '#ed6c02',
          '#2e7d32',
          '#673ab7',
          '#d32f2f',
          '#00897b',
          '#c2185b',
          '#8e24aa',
          '#0288d1',
          '#689f38'
        ]
      };
  }

  private getScoreColor(
    score: number,
    colors: FinancialHealthChartColors
  ): string {
    if (score >= 85) {
      return colors.positive;
    }

    if (score >= 70) {
      return colors.info;
    }

    if (score >= 50) {
      return colors.warning;
    }

    return colors.danger;
  }

  private withOpacity(hexColor: string, opacity: number): string {
    const normalizedHex = hexColor.replace('#', '');

    if (normalizedHex.length !== 6) {
      return hexColor;
    }

    const red = parseInt(normalizedHex.substring(0, 2), 16);
    const green = parseInt(normalizedHex.substring(2, 4), 16);
    const blue = parseInt(normalizedHex.substring(4, 6), 16);

    return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
  }
}
