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
  selector: 'app-expenses-by-category-report',
  templateUrl: './expenses-by-category-report.component.html',
  styleUrls: ['./expenses-by-category-report.component.scss'],
})
export class ExpensesByCategoryReportComponent implements OnInit, AfterViewInit {
  @Input() categoryId: number | undefined;
  @Input() initialReference: string | undefined;
  @Input() finalReference: string | undefined;
  @Input() groupByCategory: boolean = false;

  @ViewChild('sortReport') sortReport!: MatSort;

  showReportProgress = false;
  data!: any[];
  total: number = 0;
  readonly detailedDataColumns = ['index', 'date', 'description', 'value', 'reference', 'card'];
  readonly groupedDataColumns = ['index', 'category', 'value', 'reference'];
  displayedDataColumns = this.detailedDataColumns;

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
}