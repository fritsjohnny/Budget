import { Component, Input, OnInit } from '@angular/core';
import { finalize } from 'rxjs';
import { Expenses } from 'src/app/models/expenses.model';
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
  expenses!: Expenses[];
  toPayTotal: number = 0;
  displayedExpensesColumns = ['index', 'description', 'toPay'];
  dataLength: number = 0;

  constructor(private expenseService: ExpenseService) {}

  ngOnInit(): void {
    this.getExpenses();
  }

  getExpenses() {
    this.showReportProgress = true;

    this.expenseService
      .readByReferences(this.initialReference!, this.finalReference!)
      .pipe(finalize(() => (this.showReportProgress = false)))
      .subscribe({
        next: (expenses) => {
          this.expenses = expenses.filter((t) => t.fixed);

          this.getExpensesTotals();

          this.dataLength = this.expenses.length;
        },
        error: () => {
          this.getExpensesTotals();
        },
      });
  }

  getExpensesTotals() {
    this.toPayTotal = this.expenses
      ? this.expenses.map((t) => t.toPay).reduce((acc, value) => acc + value, 0)
      : 0;
  }
}
