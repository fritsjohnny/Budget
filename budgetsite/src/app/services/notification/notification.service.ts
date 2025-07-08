import { Injectable } from '@angular/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { UserService } from '../user/user.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor(private userService: UserService) { }

  async initNotifications() {
    // Solicita permissão
    let permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive !== 'granted') return;

    // Registra no FCM
    await PushNotifications.register();

    // Escuta token recebido
    PushNotifications.addListener('registration', (token) => {
      console.log('Token FCM:', token.value);
      // Você deve enviar esse token para seu backend (BudgetAPI)
      this.userService.enviarFcmToken(token.value).subscribe({
        next: (response) => {
          console.log('Token FCM enviado com sucesso:', response);
        },
        error: (error) => {
          console.error('Erro ao enviar token FCM:', error);
        }
      });
    });

    // Escuta notificações recebidas
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Notificação recebida no app:', notification);
    });

    // Escuta quando o usuário toca na notificação
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Usuário interagiu com a notificação:', action);
    });
  }
}
