import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ExpenseService } from './expense.service';
import { Expenses } from 'src/app/models/expenses.model';
import { BudgetNotifierPlugin } from 'capacitor-budget-notifier/src';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(private expenseService: ExpenseService) {}

  async scheduleDailyWorker() {
    try {
      const result = await BudgetNotifierPlugin.schedule();
      console.log(
        'Agendamento do worker de notificação feito com sucesso:',
        result
      );
    } catch (err) {
      console.error('Erro ao agendar worker de notificação:', err);
    }
  }

  async checkAndScheduleNotifications(): Promise<void> {
    debugger;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysAhead = 3; // Número de dias para verificar despesas futuras

    // Agendar o worker de notificação para rodar diariamente
    this.expenseService
      .getUpcomingOrOverdueExpenses(daysAhead)
      .subscribe((expenses: Expenses[]) => {
        expenses.forEach((expense) => {
          if (!expense.dueDate) return;

          const due = new Date(expense.dueDate);
          due.setHours(0, 0, 0, 0);
          const diffDays = Math.floor(
            (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );

          let title = '';
          let body = `${expense.description} - R$ ${expense.toPay}`;

          if (diffDays === 0) {
            title = 'Despesa vence hoje';
          } else if (diffDays < 0) {
            title = 'Despesa vencida';
          } else if (diffDays <= daysAhead) {
            title = `Despesa a vencer em ${diffDays} dia${
              diffDays === 1 ? '' : 's'
            }`;
          }

          if (title) {
            LocalNotifications.schedule({
              notifications: [
                {
                  id: expense.id ?? Math.floor(Math.random() * 100000),
                  title,
                  body,
                  schedule: { at: new Date(Date.now() + 1000) },
                },
              ],
            });
          }
        });
      });
  }
}
