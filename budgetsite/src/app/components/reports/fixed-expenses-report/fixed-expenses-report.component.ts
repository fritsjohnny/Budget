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

@Component({
  selector: 'app-fixed-expenses-report',
  templateUrl: './fixed-expenses-report.component.html',
  styleUrls: ['./fixed-expenses-report.component.scss'],
})
export class FixedExpensesReportComponent implements OnInit, AfterViewInit {
  @Input() initialReference: string | undefined;
  @Input() finalReference: string | undefined;

  @ViewChild('sortReport') sortReport!: MatSort;

  showReportProgress = false;
  data!: any[];
  total: number = 0;
  displayedDataColumns = ['index', 'description', 'value', 'category'];

  dataSourceReport = new MatTableDataSource(this.data);

  constructor(
    private expenseService: ExpenseService,
    private cardPostingsService: CardPostingsService,
    private _liveAnnouncer: LiveAnnouncer
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.getExpensesAndCardsPostings();
  }

  getExpensesAndCardsPostings() {
    this.showReportProgress = true;

    forkJoin({
      expenses: this.expenseService.readByReferences(
        this.initialReference!,
        this.finalReference!
      ),
      cardPostings: this.cardPostingsService.readByReferences(
        this.initialReference!,
        this.finalReference!
      ),
    })
      .pipe(finalize(() => (this.showReportProgress = false)))
      .subscribe({
        next: ({ expenses, cardPostings }) => {
          this.data = [
            ...expenses.filter((e) => e.fixed),
            ...cardPostings.filter((cp) => cp.fixed),
          ].map((item: Expenses | CardsPostings) => ({
            description: item.description,
            value:
              (item as Expenses).toPay ?? (item as CardsPostings).amount ?? 0,
            category: item.category ?? 0,
          }));

          this.dataSourceReport = new MatTableDataSource(this.data);

          this.dataSourceReport.data.forEach((item, index) => {
            item.index = index + 1;
          });

          setTimeout(() => {
            if (this.sortReport) {
              this.dataSourceReport.sort = this.sortReport;

              // Ouve as mudanças na ordenação
              this.sortReport.sortChange.subscribe(() => {
                setTimeout(() => {
                  this.recalculateIndexes();
                });
              });

              this.recalculateIndexes();
            }
          });

          this.getDataTotals();
        },
        error: () => this.getDataTotals(),
      });
  }

  getDataTotals() {
    this.total = this.data
      ? this.data.map((t) => t.value).reduce((acc, value) => acc + value, 0)
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

    // Aplica a ordenação correta
    const sortedData = this.dataSourceReport.sortData(
      this.dataSourceReport.filteredData.slice(),
      this.sortReport
    );

    // Recalcula os índices corretamente após a ordenação
    sortedData.forEach((item, index) => {
      item.index = index + 1;
    });

    this.dataSourceReport.data = sortedData; // Força a atualização da tabela
  }
}
