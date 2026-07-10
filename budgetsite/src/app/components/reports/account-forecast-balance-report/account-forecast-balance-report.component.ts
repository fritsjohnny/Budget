import { LiveAnnouncer } from '@angular/cdk/a11y';
import { AfterViewInit, Component, Input, ViewChild } from '@angular/core';
import { MatSort, Sort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { finalize } from 'rxjs';
import {
  AccountForecastBalanceReport,
  AccountForecastBalanceReportRow
} from 'src/app/models/account-forecast-balance-report.model';
import { AccountService } from 'src/app/services/account/account.service';

interface AccountForecastBalanceReportTableRow extends AccountForecastBalanceReportRow {
  index: number;
}

@Component({
  selector: 'app-account-forecast-balance-report',
  templateUrl: './account-forecast-balance-report.component.html',
  styleUrls: ['./account-forecast-balance-report.component.scss']
})
export class AccountForecastBalanceReportComponent implements AfterViewInit {
  @Input() accountId: number = 0;
  @Input() initialDate: Date | null = null;
  @Input() finalDate: Date | null = null;

  @ViewChild('sortReport') sortReport!: MatSort;

  showReportProgress = false;
  report: AccountForecastBalanceReport | null = null;
  displayedDataColumns = ['index', 'date', 'description', 'amount', 'balance', 'reference'];
  dataSourceReport = new MatTableDataSource<AccountForecastBalanceReportTableRow>([]);

  constructor(
    private accountService: AccountService,
    private liveAnnouncer: LiveAnnouncer
  ) { }

  ngAfterViewInit(): void {
    this.getReport();
  }

  getReport(): void {
    if (!this.accountId || !this.initialDate || !this.finalDate) {
      return;
    }

    this.showReportProgress = true;

    const initialDate = this.formatDateForApi(this.initialDate);
    const finalDate = this.formatDateForApi(this.finalDate);

    this.accountService
      .getForecastBalanceReport(this.accountId, initialDate, finalDate)
      .pipe(finalize(() => this.showReportProgress = false))
      .subscribe({
        next: (report: AccountForecastBalanceReport) => {
          this.report = report;

          const rows: AccountForecastBalanceReportTableRow[] = (report.rows ?? [])
            .map((row, index) => ({
              ...row,
              amount: row.amount ?? 0,
              balance: row.balance ?? 0,
              index: index + 1
            }));

          this.dataSourceReport = new MatTableDataSource(rows);
          this.dataSourceReport.sortData = (data, sort) => this.sortRows(data, sort);

          setTimeout(() => {
            if (this.sortReport) {
              this.dataSourceReport.sort = this.sortReport;
            }
          });
        },
        error: () => {
          this.report = null;
          this.dataSourceReport = new MatTableDataSource<AccountForecastBalanceReportTableRow>([]);
        }
      });
  }

  announceSortChange(sortState: Sort): void {
    if (sortState.direction) {
      this.liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
      return;
    }

    this.liveAnnouncer.announce('Sorting cleared');
  }

  formatReference(reference: string): string {
    if (!reference || reference.length !== 6) {
      return reference;
    }

    return `${reference.substring(4, 6)}/${reference.substring(0, 4)}`;
  }

  private sortRows(
    data: AccountForecastBalanceReportTableRow[],
    sort: Sort
  ): AccountForecastBalanceReportTableRow[] {
    const direction = sort.direction === 'asc' ? 1 : -1;

    const sortedRows = data.slice().sort((first, second) => {
      const firstValue = this.getSortValue(first, sort.active);
      const secondValue = this.getSortValue(second, sort.active);

      const comparison = this.compareValues(firstValue, secondValue);

      if (comparison !== 0) {
        return comparison * direction;
      }

      if (sort.active === 'date' && first.type !== second.type) {
        return first.type === 'R' ? -1 : 1;
      }

      return first.sequence - second.sequence;
    });

    sortedRows.forEach((row, index) => row.index = index + 1);

    return sortedRows;
  }

  private getSortValue(
    row: AccountForecastBalanceReportTableRow,
    column: string
  ): string | number {
    switch (column) {
      case 'date':
        return new Date(row.date).getTime();
      case 'description':
        return (row.description ?? '').toLocaleLowerCase();
      case 'amount':
        return row.amount;
      case 'balance':
        return row.balance;
      case 'reference':
        return row.reference ?? '';
      default:
        return row.sequence;
    }
  }

  private compareValues(first: string | number, second: string | number): number {
    if (first < second) {
      return -1;
    }

    if (first > second) {
      return 1;
    }

    return 0;
  }

  private formatDateForApi(value: Date): string {
    const date = new Date(value as any);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
