// notification.util.ts
import {
  LocalNotifications,
  LocalNotificationSchema,
} from '@capacitor/local-notifications';

/**
 * Agenda uma notificação local para cada conta vencendo.
 * @param contas Lista de contas com campos: id, descricao, dataVencimento (Date)
 */
export async function agendarNotificacoesDeContas(
  contas: { id: number; descricao: string; dataVencimento: Date }[]
) {
  const notificacoes: LocalNotificationSchema[] = contas.map((conta) => ({
    id: conta.id,
    title: 'Vencimento de Despesa',
    body: `A despesa ${
      conta.descricao
    } vence em ${conta.dataVencimento.toLocaleDateString()}`,
    schedule: { at: conta.dataVencimento },
    sound: undefined,
    extra: { tipo: 'conta', id: conta.id },
  }));

  await LocalNotifications.schedule({ notifications: notificacoes });
}

/**
 * Limpa todas as notificações agendadas e exibidas.
 */
export async function limparTodasNotificacoes() {
  await LocalNotifications.cancel({ notifications: [] }); // Cancela todas
  await LocalNotifications.removeAllDeliveredNotifications(); // Remove as já entregues
}

/**
 * Lista todas as notificações ainda pendentes (agendadas).
 */
export async function listarNotificacoesPendentes(): Promise<
  LocalNotificationSchema[]
> {
  const pending = await LocalNotifications.getPending();
  return pending.notifications;
}
