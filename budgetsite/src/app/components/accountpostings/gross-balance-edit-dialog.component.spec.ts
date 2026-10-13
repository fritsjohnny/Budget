/// <reference types="jasmine" />

import { GrossBalanceEditDialogComponent } from './gross-balance-edit-dialog.component';

describe('GrossBalanceEditDialogComponent assistente de saldo bruto', () => {
  function createComponent() {
    const dialogRef = { close: jasmine.createSpy('close') };
    const yieldService = {
      suggestGrossBalanceFromNetYield: jasmine.createSpy('suggestGrossBalanceFromNetYield').and.resolveTo({
        suggestedGrossBalance: 6502.71,
        grossTarget: 3.47,
        currentYield: { grossYield: 4.03, netYield: 3.15, irTotal: 0.88, iofTotal: 0 },
      }),
      previewYieldForGrossBalance: jasmine.createSpy('previewYieldForGrossBalance').and.resolveTo({
        grossYield: 3.47, netYield: 2.71, irTotal: 0.76, iofTotal: 0,
      }),
      inferAlgorithm: () => '1',
    };
    const component = new GrossBalanceEditDialogComponent(
      dialogRef as any,
      { amount: 7552.14, account: { id: 7, userId: 1, name: 'Conta Nubank', totalBalanceGross: 7552.14 } } as any,
      yieldService as any
    );
    return { component, dialogRef, yieldService };
  }

  it('inicia desmarcado e mantém a edição manual', () => {
    const { component } = createComponent();
    expect(component.assistantEnabled).toBeFalse();
    component.form.controls['amount'].setValue(7000);
    component.save();
    expect(component.dialogRef.close).toHaveBeenCalledWith(7000);
  });

  it('calcula sem alterar o campo e mantém o valor ao desmarcar', async () => {
    const { component, yieldService } = createComponent();
    component.setAssistantEnabled(true);
    component.targetNetYield.setValue(2.71);
    await component.calculateSuggestion();
    expect(yieldService.suggestGrossBalanceFromNetYield).toHaveBeenCalled();
    expect(component.form.controls['amount'].value).toBe(7552.14);
    expect(component.suggestion?.suggestedGrossBalance).toBe(6502.71);
    component.useSuggestion();
    component.setAssistantEnabled(false);
    expect(component.form.controls['amount'].value).toBe(6502.71);
    expect(component.dialogRef.close).not.toHaveBeenCalled();
  });
});
