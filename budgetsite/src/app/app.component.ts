import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { ThemeService } from './services/theme/theme.service';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../environments/environment';
import { NotificationService } from './services/notification/notification.service';
import { BiometricAuthService } from './core/services/biometric-auth.service';
import { App } from '@capacitor/app';
import { UserService } from './services/user/user.service';
import {
  NotificationPayload,
  NotificationReader,
  PluginListenerHandle,
} from 'capacitor-notification-reader/src';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  showBottomTabs = false;

  private sub: any;
  private cardNotificationOpenedListener?: PluginListenerHandle;
  private notificationNavigationInProgress = false;
  private currentCardNotificationKey?: string;
  private queuedCardNotification?: { package: string; title: string; text: string; receivedAt?: string | number };
  private recentCardNotificationKey?: string;
  private recentCardNotificationAt = 0;
  private foregroundAuthenticationPromise?: Promise<boolean>;
  private resumeNotificationCheckTimer?: number;
  private keyboardViewport?: VisualViewport;
  private keyboardViewportHeight = 0;
  private keyboardOpen = false;
  private keyboardScrollContainer?: HTMLElement;
  private keyboardScrollTop = 0;
  private pageScrollTop = 0;
  private focusedEditableElement?: HTMLElement;
  private keyboardScrollTimer?: number;
  private readonly handleBudgetLayoutChange = (event: Event): void => {
    const layout = (event as CustomEvent<string>).detail;
    this.applyBudgetLayoutClass(layout);
  };

  private readonly handleNativeCardNotificationOpened = (event: Event): void => {
    const payload = (event as CustomEvent<NotificationPayload>).detail;

    if (payload) {
      void this.navigateToPendingCardNotification(payload);
    }
  };

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
        const currentUrl = evt.urlAfterRedirects.split(/[?#]/, 1)[0];
        this.showBottomTabs = !['/login', '/usersregister'].includes(currentUrl);
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
    window.addEventListener(
      'native-card-notification-opened',
      this.handleNativeCardNotificationOpened
    );
    void this.initializeCardNotificationNavigation();
    this.applyBudgetLayoutClass(localStorage.getItem('budgetLayout'));
    window.addEventListener('budget-layout-change', this.handleBudgetLayoutChange);
    this.initializeModernKeyboardScroll();

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

      const authenticated = await this.ensureForegroundAuthentication();

      if (authenticated) {
        if (this.resumeNotificationCheckTimer != null) {
          window.clearTimeout(this.resumeNotificationCheckTimer);
        }

        this.resumeNotificationCheckTimer = window.setTimeout(() => {
          this.resumeNotificationCheckTimer = undefined;
          void this.navigateToPendingCardNotification();
        }, 300);
      }
    });
  }

  ngOnDestroy() {
    this.sub?.remove?.();
    void this.cardNotificationOpenedListener?.remove();
    this.keyboardViewport?.removeEventListener('resize', this.handleKeyboardViewportChange);
    this.keyboardViewport?.removeEventListener('scroll', this.handleKeyboardViewportChange);
    document.removeEventListener('focusin', this.handleModernFieldFocus);
    document.removeEventListener('focusout', this.handleModernFieldBlur);
    window.removeEventListener('budget-layout-change', this.handleBudgetLayoutChange);
    window.removeEventListener(
      'native-card-notification-opened',
      this.handleNativeCardNotificationOpened
    );
    document.body.classList.remove('modern-layout');
    if (this.keyboardScrollTimer != null) window.clearTimeout(this.keyboardScrollTimer);
    if (this.resumeNotificationCheckTimer != null) window.clearTimeout(this.resumeNotificationCheckTimer);
  }

  private async initializeCardNotificationNavigation(): Promise<void> {
    localStorage.removeItem('cardNotificationNavigationHandled');

    try {
      this.cardNotificationOpenedListener = await NotificationReader.addListener(
        'cardNotificationOpened',
        (payload) => {
          void this.navigateToPendingCardNotification(payload);
        }
      );

      await this.navigateToPendingCardNotification();
    } catch (error) {
      console.error('Não foi possível inicializar a abertura de notificações de cartão:', error);
    }
  }

  private async navigateToPendingCardNotification(
    eventPayload?: { package: string; title: string; text: string; receivedAt?: string | number }
  ): Promise<void> {
    const notification = eventPayload ??
      (await NotificationReader.getPendingNotification()).notification;
    if (!notification) return;

    const notificationKey = this.getPendingNotificationKey(notification);
    const isRecentDuplicate =
      !!notificationKey &&
      notificationKey === this.recentCardNotificationKey &&
      Date.now() - this.recentCardNotificationAt < 5000;

    if (isRecentDuplicate) return;

    if (this.notificationNavigationInProgress) {
      if (!notificationKey || notificationKey !== this.currentCardNotificationKey) {
        this.queuedCardNotification = notification;
      }
      return;
    }

    if (notificationKey) {
      localStorage.setItem('pendingCardNotificationOpen', notificationKey);
    }
    localStorage.setItem('pendingCardNotificationPayload', JSON.stringify(notification));

    this.notificationNavigationInProgress = true;
    this.currentCardNotificationKey = notificationKey;
    this.recentCardNotificationKey = notificationKey;
    this.recentCardNotificationAt = Date.now();

    try {
      const authenticated = await this.ensureForegroundAuthentication();
      if (!authenticated) {
        localStorage.removeItem('pendingCardNotificationOpen');
        localStorage.removeItem('pendingCardNotificationPayload');

        try {
          await NotificationReader.clearPendingNotification();
        } catch (error) {
          console.error('Não foi possível descartar a notificação após falha na autenticação:', error);
        }
        return;
      }

      await this.waitForStartupRender();
      localStorage.setItem('lastVisitedRoute', '/cards');

      const currentRoute = this.router.url.split(/[?#]/, 1)[0];
      if (currentRoute !== '/cards') {
        await this.router.navigateByUrl('/cards');
      }

      await this.waitForStartupRender();
      window.dispatchEvent(new CustomEvent('card-notification-route-ready', {
        detail: notification,
      }));
    } catch (error) {
      console.error('Não foi possível navegar até a compra detectada:', error);
    } finally {
      this.notificationNavigationInProgress = false;
      this.currentCardNotificationKey = undefined;

      const queuedNotification = this.queuedCardNotification;
      this.queuedCardNotification = undefined;
      if (queuedNotification) {
        void this.navigateToPendingCardNotification(queuedNotification);
      }
    }
  }

  private async ensureForegroundAuthentication(): Promise<boolean> {
    if (this.foregroundAuthenticationPromise) return this.foregroundAuthenticationPromise;

    const authentication = this.authenticateForegroundSession();
    this.foregroundAuthenticationPromise = authentication;

    try {
      return await authentication;
    } finally {
      if (this.foregroundAuthenticationPromise === authentication) {
        this.foregroundAuthenticationPromise = undefined;
      }
    }
  }

  private async authenticateForegroundSession(): Promise<boolean> {
    if (this.bio.isBiometricInProgress()) {
      return this.bio.authenticate();
    }

    const needsReauthentication = await this.bio.needsReauth();
    await this.bio.clearPaused();

    if (!needsReauthentication) return true;

    const token = await this.userService.getUserTokenAsync();
    if (!token) {
      await this.router.navigateByUrl('login', { replaceUrl: true });
      return false;
    }

    this.bio.suppressGuardPromptOnce();
    const authenticated = await this.bio.authenticate();

    if (!authenticated) {
      await this.router.navigateByUrl('login', { replaceUrl: true });
    }

    return authenticated;
  }

  private getPendingNotificationKey(notification: {
    package?: string;
    title?: string;
    text?: string;
    receivedAt?: string | number;
  }): string {
    return [
      notification.package ?? '',
      notification.title ?? '',
      notification.text ?? '',
      notification.receivedAt ?? '',
    ].join('|');
  }

  private waitForStartupRender(): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }, 0);
    });
  }

  private applyBudgetLayoutClass(layout: string | null): void {
    document.body.classList.toggle('modern-layout', layout === 'modern');
  }

  private initializeModernKeyboardScroll(): void {
    if (!window.visualViewport) return;

    this.keyboardViewport = window.visualViewport;
    this.keyboardViewportHeight = this.keyboardViewport.height;
    document.documentElement.style.setProperty('--visual-viewport-height', `${this.keyboardViewport.height}px`);
    this.keyboardViewport.addEventListener('resize', this.handleKeyboardViewportChange);
    this.keyboardViewport.addEventListener('scroll', this.handleKeyboardViewportChange);
    document.addEventListener('focusin', this.handleModernFieldFocus);
    document.addEventListener('focusout', this.handleModernFieldBlur);
  }

  private readonly handleModernFieldFocus = (event: FocusEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target || !this.isEditableElement(target) || localStorage.getItem('budgetLayout') !== 'modern') return;

    const modernDialog = target.closest('.modern-entry-dialog, .modern-account-dialog');
    if (!modernDialog) return;

    this.focusedEditableElement = target;
    const scrollContainer = target.closest('[mat-dialog-content], .modern-entry-content') as HTMLElement | null;
    this.keyboardScrollContainer = scrollContainer ?? undefined;
    this.keyboardScrollTop = scrollContainer?.scrollTop ?? 0;
    this.pageScrollTop = window.scrollY;
    this.scheduleFocusedFieldVisibility();
  };

  private readonly handleModernFieldBlur = (): void => {
    window.setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (!activeElement || !this.isEditableElement(activeElement)) this.focusedEditableElement = undefined;
    }, 0);
  };

  private readonly handleKeyboardViewportChange = (): void => {
    if (!this.keyboardViewport) return;

    const viewportHeight = this.keyboardViewport.height;
    document.documentElement.style.setProperty('--visual-viewport-height', `${viewportHeight}px`);
    const keyboardHeight = Math.max(0, window.innerHeight - viewportHeight - this.keyboardViewport.offsetTop);
    const keyboardIsOpen = keyboardHeight > 120 && !!this.focusedEditableElement;

    if (keyboardIsOpen) {
      document.body.classList.add('modern-keyboard-open');
      this.keyboardOpen = true;
      this.scheduleFocusedFieldVisibility();
    } else if (this.keyboardOpen && keyboardHeight <= 120) {
      document.body.classList.remove('modern-keyboard-open');
      this.keyboardOpen = false;
      this.restorePreKeyboardPosition();
    }

    this.keyboardViewportHeight = viewportHeight;
  };

  private scheduleFocusedFieldVisibility(): void {
    if (this.keyboardScrollTimer != null) window.clearTimeout(this.keyboardScrollTimer);
    this.keyboardScrollTimer = window.setTimeout(() => this.ensureFocusedFieldIsVisible(), 180);
  }

  private ensureFocusedFieldIsVisible(): void {
    const target = this.focusedEditableElement;
    const viewport = this.keyboardViewport;
    if (!target || !viewport || !document.body.contains(target)) return;

    const field = (target.closest('.mat-form-field, .modern-inline-option') as HTMLElement | null) ?? target;
    const rect = field.getBoundingClientRect();
    const visibleTop = viewport.offsetTop + 12;
    const actions = target.closest('.modern-entry-dialog, .modern-account-dialog')?.querySelector('[mat-dialog-actions]') as HTMLElement | null;
    const actionsHeight = actions?.getBoundingClientRect().height ?? 0;
    const visibleBottom = viewport.offsetTop + viewport.height - actionsHeight - 12;

    if (rect.bottom > visibleBottom) {
      this.scrollFocusedArea(rect.bottom - visibleBottom);
    } else if (rect.top < visibleTop) {
      this.scrollFocusedArea(rect.top - visibleTop);
    }
  }

  private scrollFocusedArea(delta: number): void {
    if (this.keyboardScrollContainer) {
      this.keyboardScrollContainer.scrollTo({ top: this.keyboardScrollContainer.scrollTop + delta, behavior: 'smooth' });
      return;
    }

    window.scrollTo({ top: window.scrollY + delta, behavior: 'smooth' });
  }

  private restorePreKeyboardPosition(): void {
    if (this.keyboardScrollTimer != null) window.clearTimeout(this.keyboardScrollTimer);
    this.keyboardScrollContainer?.scrollTo({ top: this.keyboardScrollTop, behavior: 'smooth' });
    window.scrollTo({ top: this.pageScrollTop, behavior: 'smooth' });
    this.keyboardScrollContainer = undefined;
  }

  private isEditableElement(element: HTMLElement): boolean {
    if (element instanceof HTMLTextAreaElement) return !element.readOnly && !element.disabled;
    if (!(element instanceof HTMLInputElement)) return false;
    return !element.readOnly && !element.disabled && !['button', 'checkbox', 'radio', 'file', 'submit'].includes(element.type);
  }
}
