import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class Messenger {
  constructor(private snackBar: MatSnackBar) { }

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

  private getPanelClass(type: 'success' | 'warning' | 'error'): string[] {
    const legacyClass = type === 'error' ? 'snackbar-error' : 'snackbar-success';

    if (localStorage.getItem('budgetLayout') !== 'modern') return [legacyClass];

    return ['modern-snackbar', `modern-snackbar-${type}`];
  }

  private getMessageType(message: string): 'success' | 'warning' {
    const normalizedMessage = message.toLocaleLowerCase('pt-BR');

    return normalizedMessage.includes('vencid') || normalizedMessage.includes('vencendo')
      ? 'warning'
      : 'success';
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
