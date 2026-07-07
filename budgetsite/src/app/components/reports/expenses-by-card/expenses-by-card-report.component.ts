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
import { BaseChartDirective } from 'ng2-charts';
import { finalize } from 'rxjs';
import { CardsPostings } from 'src/app/models/cardspostings.model';
import { CardPostingsService } from 'src/app/services/cardpostings/cardpostings.service';

@Component({
  selector: 'app-expenses-by-card-report',
  templateUrl: './expenses-by-card-report.component.html',
  styleUrls: ['./expenses-by-card-report.component.scss'],
})
export class ExpensesByCardReportComponent implements OnInit, AfterViewInit {
  @Input() cardId: number | undefined;
  @Input() initialReference: string | undefined;
  @Input() finalReference: string | undefined;
  @Input() onlyMyExpenses: boolean = false;
  @Input() showDisabledCards: boolean = false;
  @Input() groupByCard: boolean = false;
  @Input() showChart: boolean = false;

  @ViewChild('sortReport') sortReport!: MatSort;
  @ViewChild(BaseChartDirective) cardChart?: BaseChartDirective;

  showReportProgress = false;
  data!: any[];
  total: number = 0;
  readonly detailedDataColumns = ['index', 'date', 'description', 'value', 'reference', 'card'];
  readonly groupedDataColumns = ['index', 'card', 'value', 'reference'];
  displayedDataColumns = this.detailedDataColumns;

  cardChartType: any = 'bar';

  cardChartData: any = {
    labels: [],
    datasets: [],
  };

  cardChartOptions: any = this.buildCardChartOptions(this.getChartColors());

  dataSourceReport = new MatTableDataSource(this.data);

  constructor(
    private cardPostingsService: CardPostingsService,
    private _liveAnnouncer: LiveAnnouncer
  ) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.getCardsPostings();
  }

  getCardsPostings() {
    this.showReportProgress = true;
    this.displayedDataColumns = this.groupByCard ? this.groupedDataColumns : this.detailedDataColumns;

    this.cardPostingsService.readByReferences(
      this.initialReference!,
      this.finalReference!,
      0,
      false
    )
      .pipe(finalize(() => (this.showReportProgress = false)))
      .subscribe({
        next: (cardPostings) => {
          const detailedData = cardPostings
            .filter((item) => this.filterCardPosting(item))
            .map((item: CardsPostings) => ({
              date: item.date ?? undefined,
              reference: item.reference,
              description: item.description,
              value: item.amount ?? 0,
              cardId: item.cardId,
              card: item.card,
              cardName: item.card?.name || 'Sem cartão',
              cardDisabled: item.card?.disabled ?? false,
              peopleId: item.peopleId,
              others: item.others,
              parcels: item.parcels,
              parcelNumber: item.parcelNumber,
              people: item.people ?? undefined,
            }));

          this.data = this.groupByCard
            ? this.groupDataByCard(detailedData)
            : detailedData.sort((a, b) => a.reference.localeCompare(b.reference));

          this.dataSourceReport = new MatTableDataSource(this.data);
          this.configureSorting();

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

  private filterCardPosting(item: CardsPostings) {
    const selectedCardId = this.cardId ?? 0;
    const matchesCard = selectedCardId === 0 || item.cardId === selectedCardId;
    const matchesDisabled = this.showDisabledCards || item.card?.disabled !== true;
    const matchesOwner = !this.onlyMyExpenses || (!item.others && item.peopleId == null);

    return matchesCard && matchesDisabled && matchesOwner;
  }

  private configureSorting() {
    this.dataSourceReport.sortingDataAccessor = (item: any, property: string) => {
      switch (property) {
        case 'card':
          return item.cardName ?? '';
        case 'date':
          return item.date ? new Date(item.date).getTime() : 0;
        case 'value':
          return item.value ?? 0;
        default:
          return item[property] ?? '';
      }
    };
  }

  private groupDataByCard(data: any[]) {
    const groupedData = new Map<string, any>();

    data.forEach((item) => {
      const cardId = item.cardId ?? 0;
      const cardName = item.cardName || 'Sem cartão';
      const reference = item.reference;
      const key = `${reference}|${cardId}|${cardName}`;
      const groupedItem = groupedData.get(key);

      if (groupedItem) {
        groupedItem.value += item.value ?? 0;
        return;
      }

      groupedData.set(key, {
        cardId,
        cardName,
        reference,
        value: item.value ?? 0,
      });
    });

    return Array.from(groupedData.values()).sort((a, b) => {
      const referenceCompare = a.reference.localeCompare(b.reference);

      if (referenceCompare !== 0) return referenceCompare;

      return a.cardName.localeCompare(b.cardName);
    });
  }

  private updateChartFromCurrentRows() {
    if (!this.groupByCard || !this.showChart) return;

    const rows = this.dataSourceReport.data ?? [];
    const values = rows.map((row) => row.value ?? 0);
    const colors = this.getChartColors();

    this.cardChartData = {
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

    this.cardChartOptions = this.buildCardChartOptions(colors);

    setTimeout(() => {
      this.cardChart?.update();
    });
  }

  private getChartLabel(row: any, rows: any[]) {
    const firstCard = rows[0]?.cardName;
    const hasMultipleCards = rows.some((item) => item.cardName !== firstCard);

    return hasMultipleCards ? `${row.reference} - ${row.cardName}` : row.reference;
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

  private buildCardChartOptions(colors: any) {
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
            maxRotation: 0,
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
