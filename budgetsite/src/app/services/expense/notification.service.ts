import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ExpenseService } from './expense.service';
import { Expenses } from 'src/app/models/expenses.model';
import { BudgetNotifierPlugin } from 'capacitor-budget-notifier/src';
import { agendarNotificacoesDeContas } from 'src/app/utils/notification.util';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  constructor(private expenseService: ExpenseService) {}

  async requestPermissionIfNeeded() {
    const { display } = await LocalNotifications.requestPermissions();
    if (display !== 'granted') {
      console.warn('Permissão para notificações não concedida');
    }
  }

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
    const daysAhead = 3;

    this.expenseService
      .getUpcomingOrOverdueExpenses(daysAhead)
      .subscribe((expenses: Expenses[]) => {
        const contas = expenses
          .filter((e) => !!e.dueDate)
          .map((e) => ({
            id: e.id ?? Math.floor(Math.random() * 100000),
            descricao: `${e.description} - R$ ${e.toPay}`,
            dataVencimento: new Date(e.dueDate!),
          }));

        agendarNotificacoesDeContas(contas);
      });
  }
}
