import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Accounts } from 'src/app/models/accounts.model';
import { YieldService } from 'src/app/services/yield/yield.service';

@Component({
  selector: 'app-gross-balance-edit-dialog',
  styleUrls: ['../budget/budget-entry-modern-dialog.scss', './gross-balance-edit-dialog-panel.scss'],
  template: `
    <section class="modern-entry-dialog gross-balance-dialog">
      <header class="modern-entry-header gross-balance-header">
        <div class="modern-entry-heading">
          <span class="modern-entry-icon gross-balance-icon"><mat-icon>edit</mat-icon></span>
          <div class="gross-balance-heading">
          <h2 mat-dialog-title>Editar saldo bruto</h2>
          <p>Atualize o saldo bruto desta conta.</p>
          </div>
        </div>
        <button type="button" mat-icon-button class="modern-entry-close gross-balance-close" aria-label="Fechar" (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </header>
      <form [formGroup]="form" (ngSubmit)="save()">
        <div mat-dialog-content class="modern-entry-content">
          <mat-form-field appearance="fill">
            <mat-label>Saldo bruto</mat-label>
            <input matInput inputmode="decimal" currencyMask formControlName="amount" cdkFocusInitial />
          </mat-form-field>
          <mat-checkbox class="gross-balance-assistant-toggle" [checked]="assistantEnabled" (change)="setAssistantEnabled($event.checked)">
            Calcular saldo bruto
          </mat-checkbox>

          <section *ngIf="assistantEnabled" class="gross-balance-assistant">
            <mat-form-field appearance="fill">
              <mat-label>Rendimento líquido do banco</mat-label>
              <input matInput inputmode="decimal" currencyMask [formControl]="targetNetYield" />
              <mat-error>Informe um valor maior que zero.</mat-error>
            </mat-form-field>

            <mat-form-field appearance="fill">
              <mat-label>Data do rendimento</mat-label>
              <input matInput [matDatepicker]="yieldDatePicker" [formControl]="yieldDate" />
              <mat-datepicker-toggle matSuffix [for]="yieldDatePicker"></mat-datepicker-toggle>
              <mat-datepicker #yieldDatePicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field *ngIf="showIofDays" appearance="fill">
              <mat-label>Dias corridos para cálculo do IOF</mat-label>
              <input matInput type="number" min="0" step="1" [formControl]="iofElapsedDays" />
            </mat-form-field>

            <button mat-stroked-button class="gross-balance-calculate" type="button"
              [disabled]="calculating || !canCalculate" (click)="calculateSuggestion()">
              <mat-spinner *ngIf="calculating" diameter="18"></mat-spinner>
              <span>{{ calculating ? 'Calculando...' : 'Calcular saldo sugerido' }}</span>
            </button>

            <p *ngIf="assistantError" class="gross-balance-assistant-error" role="alert">{{ assistantError }}</p>

            <div *ngIf="suggestion" class="gross-balance-suggestion">
              <div class="gross-balance-suggestion-main">
                <span>Saldo sugerido</span>
                <strong>{{ suggestion.suggestedGrossBalance | currency:'BRL':'symbol':'1.2-2' }}</strong>
              </div>
              <div class="gross-balance-suggestion-row">
                <span>Diferença</span>
                <strong>{{ suggestion.difference | currency:'BRL':'symbol':'1.2-2' }}</strong>
              </div>
              <div class="gross-balance-suggestion-row">
                <span>Rendimento líquido simulado</span>
                <strong>{{ suggestion.simulatedNetYield | currency:'BRL':'symbol':'1.2-2' }}</strong>
              </div>
              <p>Bruto: {{ suggestion.grossYield | currency:'BRL':'symbol':'1.2-2' }}
                | IR: {{ suggestion.irTotal | currency:'BRL':'symbol':'1.2-2' }}</p>
              <button mat-flat-button class="modern-save-action gross-balance-use" type="button" (click)="useSuggestion()">
                Usar valor sugerido
              </button>
            </div>
          </section>
        </div>
        <div mat-dialog-actions class="modern-entry-actions">
          <button mat-stroked-button class="modern-cancel-action" type="button" (click)="dialogRef.close()">Cancelar</button>
          <button mat-flat-button class="modern-save-action" type="submit" [disabled]="form.invalid"><mat-icon>save</mat-icon>Salvar</button>
        </div>
      </form>
    </section>
  `
})
export class GrossBalanceEditDialogComponent {
  readonly form = new FormGroup({ amount: new FormControl(0, [Validators.required, Validators.min(0)]) });
  readonly targetNetYield = new FormControl(null, [Validators.required, Validators.min(0.01)]);
  readonly yieldDate = new FormControl(new Date(), Validators.required);
  readonly iofElapsedDays = new FormControl(0, [Validators.min(0)]);
  assistantEnabled = false;
  calculating = false;
  assistantError = '';
  suggestion: {
    suggestedGrossBalance: number;
    difference: number;
    simulatedNetYield: number;
    grossYield: number;
    irTotal: number;
    iofTotal: number;
  } | null = null;
  readonly showIofDays: boolean;

  constructor(
    public dialogRef: MatDialogRef<GrossBalanceEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) private data: { amount: number; account: Accounts },
    private yieldService: YieldService
  ) {
    this.form.controls['amount'].setValue(data.amount);
    this.showIofDays = ['1', '3', '4', '5'].includes(this.resolveAlgorithm(data.account) ?? '');
    this.iofElapsedDays.setValue(this.loadIofDays(data.account.id));
  }

  setAssistantEnabled(enabled: boolean): void {
    this.assistantEnabled = enabled;
    this.assistantError = '';
    if (!enabled) this.suggestion = null;
  }

  async calculateSuggestion(): Promise<void> {
    if (!this.canCalculate || this.calculating) return;
    const account = this.data.account;
    const currentGrossBalance = Number(this.form.controls['amount'].value);
    const target = Number(this.targetNetYield.value);
    const date = this.yieldDate.value;
    if (!account || !Number.isFinite(currentGrossBalance) || !Number.isFinite(target) || !date) return;

    this.calculating = true;
    this.assistantError = '';
    this.suggestion = null;
    try {
      const result = await this.yieldService.suggestGrossBalanceFromNetYield(
        account,
        currentGrossBalance,
        target,
        date,
        this.showIofDays ? Number(this.iofElapsedDays.value ?? 0) : undefined
      );
      const scale = result.currentYield.grossYield > 0
        ? result.grossTarget / result.currentYield.grossYield
        : 0;
      this.suggestion = {
        suggestedGrossBalance: result.suggestedGrossBalance,
        difference: Math.round((result.suggestedGrossBalance - currentGrossBalance + Number.EPSILON) * 100) / 100,
        simulatedNetYield: target,
        grossYield: result.grossTarget,
        irTotal: Math.round((result.currentYield.irTotal * scale + Number.EPSILON) * 100) / 100,
        iofTotal: Math.round((result.currentYield.iofTotal * scale + Number.EPSILON) * 100) / 100
      };
    } catch (error) {
      this.assistantError = error instanceof Error && error.message
        ? error.message
        : 'Não foi possível calcular o saldo sugerido.';
    } finally {
      this.calculating = false;
    }
  }

  useSuggestion(): void {
    if (this.suggestion) this.form.controls['amount'].setValue(this.suggestion.suggestedGrossBalance);
  }

  get canCalculate(): boolean {
    return this.targetNetYield.valid && Number(this.targetNetYield.value) > 0
      && this.yieldDate.valid && !!this.yieldDate.value
      && (!this.showIofDays || (this.iofElapsedDays.valid && Number(this.iofElapsedDays.value) >= 0));
  }

  private resolveAlgorithm(account: Accounts): string | undefined {
    if (account.id) {
      const stored = localStorage.getItem(`budget.algorithmType.${account.id}`);
      if (stored) return stored;
    }
    return this.yieldService.inferAlgorithm(account.name);
  }

  private loadIofDays(accountId?: number): number {
    if (!accountId) return 0;
    const stored = localStorage.getItem(`budget.iofElapsedDays.${accountId}`);
    if (stored !== null) {
      const days = Math.max(0, Math.trunc(Number(stored) || 0));
      const storedDate = localStorage.getItem(`budget.iofElapsedDate.${accountId}`);
      if (storedDate) {
        const date = new Date(storedDate);
        date.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return days + Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000));
      }
      return days;
    }
    return 0;
  }

  save(): void {
    if (this.form.valid) this.dialogRef.close(Number(this.form.controls['amount'].value));
  }
}
