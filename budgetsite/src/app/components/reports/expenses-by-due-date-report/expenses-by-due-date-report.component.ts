import { LiveAnnouncer } from '@angular/cdk/a11y';
import { AfterViewInit, Component, Input, OnInit, ViewChild } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { finalize } from 'rxjs';
import { ExpenseService } from 'src/app/services/expense/expense.service';

interface ExpensesDueDateReportRow {
  id: number;
  dueDate?: string;
  reference?: string;
  description?: string;
  toPay: number;
  paid: number;
  remaining: number;
  categoryId?: number;
  categoryName?: string;
  peopleId?: number;
}

@Component({
  selector: 'app-expenses-by-due-date-report',
  templateUrl: './expenses-by-due-date-report.component.html',
  styleUrls: ['./expenses-by-due-date-report.component.scss'],
})
export class ExpensesByDueDateReportComponent implements OnInit, AfterViewInit {
  @Input() initialDate: Date | null = null;
  @Input() finalDate: Date | null = null;

  @ViewChild('sortReport') sortReport!: MatSort;

  showReportProgress = false;

  data: ExpensesDueDateReportRow[] = [];
  total: number = 0;

  displayedDataColumns = ['index', 'dueDate', 'description', 'remaining', 'reference', 'category'];
  dataSourceReport = new MatTableDataSource(this.data);

  constructor(
    private expenseService: ExpenseService,
    private _liveAnnouncer: LiveAnnouncer
  ) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.getReport();
  }

  onGenerateClick() {
    this.getReport();
  }

  getReport() {
    if (!this.initialDate || !this.finalDate) return;

    this.showReportProgress = true;

    //formar as datas no formato YYYY-MM-DD sem timezone (para evitar problemas de timezone, considerando que o backend espera as datas nesse formato)
    const initialDateStr = this.initialDate.toISOString().split('T')[0];
    const finalDateStr = this.finalDate.toISOString().split('T')[0];

    this.expenseService
      .readByDueDateRange(initialDateStr, finalDateStr)
      .pipe(finalize(() => (this.showReportProgress = false)))
      .subscribe({
        next: (rows: ExpensesDueDateReportRow[]) => {
          this.data = (rows ?? []).map((r) => ({
            ...r,
            // garante os campos numéricos (evita NaN em somas)
            toPay: r.toPay ?? 0,
            paid: r.paid ?? 0,
            remaining: r.remaining ?? 0,
            reference: r.reference && r.reference.length === 6
              ? `${r.reference.substring(4, 6)}/${r.reference.substring(0, 4)}`
              : r.reference,
          }));

          this.dataSourceReport = new MatTableDataSource(this.data);

          this.dataSourceReport.data.forEach((item: any, index: number) => {
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
        },
        error: () => this.getDataTotals(),
      });
  }

  getDataTotals() {
    this.total = this.data
      ? this.data.map((t) => t.remaining).reduce((acc, value) => acc + value, 0)
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

    sortedData.forEach((item: any, index: number) => {
      item.index = index + 1;
    });

    this.dataSourceReport.data = sortedData;
  }
}
