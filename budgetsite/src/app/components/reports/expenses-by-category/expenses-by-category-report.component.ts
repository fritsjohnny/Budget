import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { finalize, forkJoin } from 'rxjs';
import { CardsPostings } from 'src/app/models/cardspostings.model';
import { Expenses } from 'src/app/models/expenses.model';
import { CardPostingsService } from 'src/app/services/cardpostings/cardpostings.service';
import { ExpenseService } from 'src/app/services/expense/expense.service';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-expenses-by-category-report',
  templateUrl: './expenses-by-category-report.component.html',
  styleUrls: ['./expenses-by-category-report.component.scss'],
})
export class ExpensesByCategoryReportComponent implements OnInit, AfterViewInit {
  @Input() categoryId: number | undefined;
  @Input() initialReference: string | undefined;
  @Input() finalReference: string | undefined;
  @Input() groupByCategory: boolean = false;
  @Input() showChart: boolean = false;

  @ViewChild('sortReport') sortReport!: MatSort;
  @ViewChild(BaseChartDirective) categoryChart?: BaseChartDirective;

  showReportProgress = false;
  data!: any[];
  total: number = 0;
  readonly detailedDataColumns = ['index', 'date', 'description', 'value', 'reference', 'card'];
  readonly groupedDataColumns = ['index', 'category', 'value', 'reference'];
  displayedDataColumns = this.detailedDataColumns;

  categoryChartType: any = 'bar';

  categoryChartData: any = {
    labels: [],
    datasets: [],
  };

  categoryChartOptions: any = this.buildCategoryChartOptions(this.getChartColors());

  dataSourceReport = new MatTableDataSource(this.data);

  constructor(
    private expenseService: ExpenseService,
    private cardPostingsService: CardPostingsService,
    private _liveAnnouncer: LiveAnnouncer
  ) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.getExpensesAndCardsPostings();
  }

  getExpensesAndCardsPostings() {
    this.showReportProgress = true;
    this.displayedDataColumns = this.groupByCategory ? this.groupedDataColumns : this.detailedDataColumns;

    forkJoin({
      expenses: this.expenseService.readByReferences(
        this.initialReference!,
        this.finalReference!,
        this.categoryId ?? 0,
        false
      ),
      cardPostings: this.cardPostingsService.readByReferences(
        this.initialReference!,
        this.finalReference!,
        this.categoryId ?? 0,
        false
      ),
    })
      .pipe(finalize(() => (this.showReportProgress = false)))
      .subscribe({
        next: ({ expenses, cardPostings }) => {
          const detailedData = [
            ...expenses,
            ...cardPostings,
          ].map((item: Expenses | CardsPostings) => ({
            date: (item as CardsPostings).date ?? undefined,
            reference: item.reference,
            description: item.description,
            value:
              (item as Expenses).toPay ?? (item as CardsPostings).amount ?? 0,
            categoryId: item.categoryId ?? 0,
            category: item.category || 'Sem categoria',
            card: (item as CardsPostings).card ?? undefined,
            peopleId: item.peopleId,
            parcels: item.parcels,
            parcelNumber: item.parcelNumber,
            people: (item as CardsPostings).people ?? undefined,
          }));

          this.data = this.groupByCategory
            ? this.groupDataByCategory(detailedData)
            : detailedData.sort((a, b) => a.reference.localeCompare(b.reference));

          this.dataSourceReport = new MatTableDataSource(this.data);

          this.dataSourceReport.data.forEach((item, index) => {
            item.index = index + 1;
          });

          setTimeout(() => {
            if (this.sortReport) {
              this.dataSourceReport.sort = this.sortReport;

              this.sortReport.sortChange.subscribe(() => {
                setTimeout(() => {
                  this.recalculateIndexes();
                });
              });

              this.recalculateIndexes();
            }
          });

          this.getDataTotals();

          setTimeout(() => {
            this.updateChartFromCurrentRows();
          });
        },
        error: () => this.getDataTotals(),
      });
  }

  getDataTotals() {
    this.total = this.data
      ? this.data.map((t) => t.value ?? 0).reduce((acc, value) => acc + value, 0)
      : 0;
  }

  announceSortChange(sortState: any) {
    if (sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }

  recalculateIndexes() {
    if (!this.dataSourceReport.sort || !this.sortReport) return;

    const sortedData = this.dataSourceReport.sortData(
      this.dataSourceReport.filteredData.slice(),
      this.sortReport
    );

    sortedData.forEach((item, index) => {
      item.index = index + 1;
    });

    this.dataSourceReport.data = sortedData;

    this.updateChartFromCurrentRows();
  }

  private groupDataByCategory(data: any[]) {
    const groupedData = new Map<string, any>();

    data.forEach((item) => {
      const categoryId = item.categoryId ?? 0;
      const category = item.category || 'Sem categoria';
      const reference = item.reference;
      const key = `${reference}|${categoryId}|${category}`;
      const groupedItem = groupedData.get(key);

      if (groupedItem) {
        groupedItem.value += item.value ?? 0;
        return;
      }

      groupedData.set(key, {
        categoryId,
        category,
        reference,
        value: item.value ?? 0,
      });
    });

    return Array.from(groupedData.values()).sort((a, b) => {
      const referenceCompare = a.reference.localeCompare(b.reference);

      if (referenceCompare !== 0) return referenceCompare;

      return a.category.localeCompare(b.category);
    });
  }

  private updateChartFromCurrentRows() {
    if (!this.groupByCategory || !this.showChart) return;

    const rows = this.dataSourceReport.data ?? [];
    const values = rows.map((row) => row.value ?? 0);
    const colors = this.getChartColors();

    this.categoryChartData = {
      labels: rows.map((row) => this.getChartLabel(row, rows)),
      datasets: [
        {
          type: 'bar',
          label: 'Valor',
          data: values,
          backgroundColor: values.map((value, index) =>
            this.getBarColor(value, values[index - 1], index, colors)
          ),
          borderColor: values.map((value, index) =>
            this.getBarColor(value, values[index - 1], index, colors)
          ),
          borderWidth: 1,
          order: 2,
        },
        {
          type: 'line',
          label: 'Evolução',
          data: values,
          borderColor: colors.line,
          backgroundColor: colors.lineBackground,
          pointBackgroundColor: colors.point,
          pointBorderColor: colors.pointBorder,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.25,
          fill: false,
          order: 1,
        },
      ],
    };

    this.categoryChartOptions = this.buildCategoryChartOptions(colors);

    setTimeout(() => {
      this.categoryChart?.update();
    });
  }

  private getChartLabel(row: any, rows: any[]) {
    const firstCategory = rows[0]?.category;
    const hasMultipleCategories = rows.some((item) => item.category !== firstCategory);

    return hasMultipleCategories ? `${row.reference} - ${row.category}` : row.reference;
  }

  private getBarColor(value: number, previousValue: number | undefined, index: number, colors: any) {
    if (index === 0 || previousValue === undefined || value === previousValue) return colors.neutral;

    return value > previousValue ? colors.up : colors.down;
  }

  private getChartColors() {
    const isDarkTheme =
      document.documentElement.classList.contains('dark-theme') ||
      document.body.classList.contains('dark-theme');

    return isDarkTheme
      ? {
        text: '#ffffff',
        grid: 'rgba(255, 255, 255, 0.18)',
        neutral: '#ffc107',
        up: '#ff9088',
        down: '#c8ffc8',
        line: '#ff6197',
        lineBackground: 'rgba(255, 97, 151, 0.15)',
        point: '#ffc107',
        pointBorder: '#ffffff',
      }
      : {
        text: '#303030',
        grid: 'rgba(0, 0, 0, 0.12)',
        neutral: '#3f51b5',
        up: '#f44336',
        down: '#008000',
        line: '#ff4081',
        lineBackground: 'rgba(255, 64, 129, 0.15)',
        point: '#ff4081',
        pointBorder: '#ffffff',
      };
  }

  private buildCategoryChartOptions(colors: any) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const value = Number(context.raw ?? 0);

              return `${context.dataset.label}: ${value.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: colors.text,
            autoSkip: false,
            maxRotation: 45,
            minRotation: 0,
            font: {
              size: 11,
            },
          },
          grid: {
            color: colors.grid,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: colors.text,
            font: {
              size: 11,
            },
            callback: (value: any) =>
              Number(value).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0,
              }),
          },
          grid: {
            color: colors.grid,
          },
        },
      },
    };
  }
}
