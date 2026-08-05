import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, throwError } from 'rxjs';
import { NotificationBubbleComponent } from 'src/app/components/notification-bubble/notification-bubble.component';

@Injectable({ providedIn: 'root' })
export class Messenger {
  private notificationOverlays: OverlayRef[] = [];

  constructor(private snackBar: MatSnackBar, private overlay: Overlay) {}

  errorHandler(err: any): Observable<any> {
    const message = this.extractMessage(err);
    
    console.log('Erro tratado:', message);
    
    this.snackBar.open(message, 'Fechar', {
      duration: 10000, 
      horizontalPosition: 'center', 
      verticalPosition: 'top',
      panelClass: this.getPanelClass('error')
    });
    
    return throwError(err);
  }

  message(response: any, duration: number = 10000): void {
    const message = this.extractMessage(response);
    
    this.snackBar.open(message, 'Fechar', {
      duration, 
      horizontalPosition: 'center', 
      verticalPosition: 'top',
      panelClass: this.getPanelClass(this.getMessageType(message))
    });
  }

  messageBubbles(messages: string[], duration: number = 10000): void {
    const validMessages = messages.filter(message => message.trim().length > 0);
    if (validMessages.length === 0) return;

    this.closeBubbles();

    validMessages.forEach((message, index) => {
      const positionStrategy = this.overlay.position().global()
        .top((16 + index * 72) + 'px')
        .centerHorizontally();

      const overlayRef = this.overlay.create({
        positionStrategy,
        hasBackdrop: false,
        scrollStrategy: this.overlay.scrollStrategies.noop(),
        panelClass: 'budget-notification-overlay-pane'
      });

      const componentRef = overlayRef.attach(new ComponentPortal(NotificationBubbleComponent));
      componentRef.instance.message = message;
      componentRef.instance.closeNotification = () => this.closeOverlay(overlayRef);

      const timer = window.setTimeout(() => this.closeOverlay(overlayRef), duration);
      overlayRef.detachments().subscribe(() => {
        window.clearTimeout(timer);
        this.removeOverlay(overlayRef);
      });

      this.notificationOverlays.push(overlayRef);
    });
  }

  private closeOverlay(overlayRef: OverlayRef): void {
    if (overlayRef.hasAttached()) overlayRef.dispose();
  }

  private removeOverlay(overlayRef: OverlayRef): void {
    this.notificationOverlays = this.notificationOverlays.filter(item => item !== overlayRef);
  }

  private closeBubbles(): void {
    this.notificationOverlays.forEach(overlayRef => overlayRef.dispose());
    this.notificationOverlays = [];
  }

  private getPanelClass(type: 'success' | 'warning' | 'error'): string[] {
    const legacyClass = type === 'error' ? 'snackbar-error' : 'snackbar-success';
    if (localStorage.getItem('budgetLayout') !== 'modern') return [legacyClass];
    return ['modern-snackbar', 'modern-snackbar-' + type];
  }

  private getMessageType(message: string): 'success' | 'warning' | 'error' {
    const normalizedMessage = message.toLocaleLowerCase('pt-BR');
    const errorIndicators = ['erro', 'error', 'falha', 'não foi possível', 'nao foi possivel', 'selecione', 'deve ser diferente', 'só é possível', 'so e possivel', 'não pode', 'nao pode', 'inválid', 'invalid'];
    if (errorIndicators.some(indicator => normalizedMessage.includes(indicator))) return 'error';
    return normalizedMessage.includes('vencid') || normalizedMessage.includes('vencendo') ? 'warning' : 'success';
  }

  private extractMessage(input: any): string {
    if (!input) return 'Erro inesperado.';
    if (typeof input === 'string') return input;
    if (input?.error?.message) return input.error.message;
    if (input?.error?.detail) return input.error.detail;
    if (input?.error && typeof input.error === 'string') return input.error;
    if (input?.message) return input.message;
    return 'Erro inesperado.';
  }
}
