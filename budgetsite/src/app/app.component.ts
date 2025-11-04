import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { ThemeService } from './services/theme/theme.service';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../environments/environment';
import { NotificationService } from './services/notification/notification.service';
import { BiometricAuthService } from './core/services/biometric-auth.service';
import { App } from '@capacitor/app';
import { UserService } from './services/user/user.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  showBottomTabs = true;

  private sub: any;

  constructor(
    private router: Router,
    private themeService: ThemeService,
    private notificationService: NotificationService,
    private bio: BiometricAuthService,
    private userService: UserService
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

    this.sub = App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) {
        // indo para background → marca horário
        await this.bio.markPausedNow();
        return;
      }

      // voltando para foreground
      // limpa "paused" para não acumular
      // (deixamos a checagem usar o pausedAt já lido antes de limpar, se quiser)
      const needs = await this.bio.needsReauth();

      await this.bio.clearPaused();

      if (needs) {
        // só faça se existir sessão (senão vai pro login mesmo)
        const token = await this.userService.getUserTokenAsync();
        if (!token) {
          this.router.navigateByUrl('login', { replaceUrl: true });
          return;
        }

        // suprime o guard (para não duplicar o prompt após navegar)
        this.bio.suppressGuardPromptOnce();

        const ok = await this.bio.authenticate();
        if (!ok) {
          // cancelou/falhou → mandar pro login
          this.router.navigateByUrl('login', { replaceUrl: true });
        }
      }
    });
  }

  ngOnDestroy() {
    this.sub?.remove?.();
  }
}
