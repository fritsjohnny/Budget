// app.component.ts
import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { ThemeService } from './services/theme/theme.service';
// import { NotificationService } from './services/expense/notification.service';
import { HealthService } from './services/health/health.service';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../environments/environment';
import { NotificationService } from './services/notification/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  showBottomTabs = true;

  constructor(
    private router: Router,
    private themeService: ThemeService,
    // private notificationService: NotificationService,
    private notificationService: NotificationService,
    private healthService: HealthService
  ) {
    this.themeService.init();
    this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationEnd) {
        this.showBottomTabs = !['/login', '/register'].includes(
          evt.urlAfterRedirects
        );
      }
    });
  }

  ngOnInit() {
    const token = localStorage.getItem('token');
    if (token) {
      Preferences.set({ key: 'auth_token', value: token });
      Preferences.set({ key: 'api_base_url', value: environment.baseUrl });
    }

    this.healthService.startPing();

    // MODO ANTIGO
    // this.notificationService.requestPermissionIfNeeded(); // novo
    // this.notificationService.scheduleDailyWorker();

    // Remover se não quiser exibir as notificações quando o app inicia, já que elas são agendadas no serviço de notificação.
    // this.notificationService.checkAndScheduleNotifications();

    // MODO NOVO
    this.notificationService.initNotifications();

    // só Android puro, sem Ionic Platform
    if (/Android/.test(navigator.userAgent) && window.visualViewport) {
      document.body.classList.add('android');
      // calcula a altura da nav-bar
      const navBarHeight = window.innerHeight - window.visualViewport.height;
      // injeta na raiz do CSS
      document.documentElement.style.setProperty(
        '--android-nav-bar-height',
        `${navBarHeight}px`
      );
    }
  }
}
