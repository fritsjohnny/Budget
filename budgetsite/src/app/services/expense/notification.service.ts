import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ExpenseService } from './expense.service';
import { Expenses } from 'src/app/models/expenses.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor(private expenseService: ExpenseService) {}

  async checkAndScheduleNotifications(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return;
    this.expenseService.getAll().subscribe((expenses: Expenses[]) => {
      expenses.forEach(expense => {
        if (!expense.dueDate) return;

        const due = new Date(expense.dueDate);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let title = '';
        let body = `${expense.description} - R$ ${expense.toPay}`;

        if (diffDays === 0) {
          title = 'Despesa vence hoje';
        } else if (diffDays < 0) {
          title = 'Despesa vencida';
        } else if (diffDays <= 3) {
          title = `Despesa a vencer em ${diffDays} dia${diffDays === 1 ? '' : 's'}`;
        }

        if (title) {
          LocalNotifications.schedule({
            notifications: [{
              id: expense.id ?? Math.floor(Math.random() * 100000),
              title,
              body,
              schedule: { at: new Date(Date.now() + 1000) },
            }]
          });
        }
      });
    });
  }
}
