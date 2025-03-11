import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, Input, OnInit } from '@angular/core';
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
export class FixedExpensesReportComponent implements OnInit {
  @Input() initialReference: string | undefined;
  @Input() finalReference: string | undefined;

  showReportProgress = false;
  data!: any[];
  toPayTotal: number = 0;
  displayedDataColumns = ['index', 'description', 'value'];
  dataLength: number = 0;

  constructor(
    private expenseService: ExpenseService,
    private cardPostingsService: CardPostingsService,
    private _liveAnnouncer: LiveAnnouncer
  ) {}

  ngOnInit(): void {
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
            Description:
              (item as Expenses).description ??
              (item as CardsPostings).description,
            Value:
              (item as Expenses).toPay ?? (item as CardsPostings).amount ?? 0,
          }));

          this.dataLength = this.data.length;

          this.getDataTotals();
        },
        error: () => this.getDataTotals(),
      });
  }

  getDataTotals() {
    debugger;
    this.toPayTotal = this.data
      ? this.data.map((t) => t.Value).reduce((acc, value) => acc + value, 0)
      : 0;
  }

  /** Announce the change in sort state for assistive technology. */
  announceSortChange(sortState: any) {
    // This example uses English messages. If your application supports
    // multiple language, you would internationalize these strings.
    // Furthermore, you can customize the message to add additional
    // details about the values being sorted.

    if (sortState.direction) {
      this._liveAnnouncer.announce(`Sorted ${sortState.direction}ending`);
    } else {
      this._liveAnnouncer.announce('Sorting cleared');
    }
  }
}
