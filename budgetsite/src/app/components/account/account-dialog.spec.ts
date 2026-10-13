/// <reference types="jasmine" />

import { FormControl, FormGroup } from '@angular/forms';
import { AccountDialog } from './account-dialog';

describe('manutenção de conta', () => {
  function createDialog(): { dialog: AccountDialog; close: jasmine.Spy } {
    const dialog = Object.create(AccountDialog.prototype) as any;
    const close = jasmine.createSpy('close');
    dialog.dialogRef = { close };
    dialog.id = 17;
    dialog.userId = 3;
    dialog.buttonName = 'Conta antiga';
    dialog.buttonText = 'Conta antiga';
    dialog.yieldRanges = [];
    dialog.picker1 = { _pickerInput: { value: { hex: '000000' } } };
    dialog.picker2 = { _pickerInput: { value: { hex: 'ffffff' } } };
    dialog.accountFormGroup = new FormGroup({
      nameFormControl: new FormControl('Conta'),
      backgroundFormControl: new FormControl('#000000'),
      colorFormControl: new FormControl('#ffffff'),
      disabledFormControl: new FormControl(false),
      calcInGeneralFormControl: new FormControl(true),
      positionFormControl: new FormControl(1),
      appPackageNameFormControl: new FormControl(''),
      yieldPercentFormControl: new FormControl(100),
      yieldIndexFormControl: new FormControl('IPCA'),
      irPercentFormControl: new FormControl(15),
      isTaxExemptFormControl: new FormControl(false),
      totalBalanceGrossFormControl: new FormControl(1000),
    });
    return { dialog, close };
  }

  it('inclui o índice de rendimento no payload de edição', () => {
    const { dialog, close } = createDialog();

    dialog.save();

    expect(close).toHaveBeenCalledWith(jasmine.objectContaining({
      id: 17,
      yieldIndex: 'IPCA',
      totalBalanceGross: 1000,
    }));
  });

  it('limpa os campos ao iniciar o cadastro de outra conta', () => {
    const { dialog } = createDialog();

    dialog.addAccount();

    expect(dialog.id).toBeUndefined();
    expect(dialog.accountFormGroup.get('yieldIndexFormControl')?.value).toBe('');
    expect(dialog.accountFormGroup.get('totalBalanceGrossFormControl')?.value).toBe('');
    expect(dialog.accountFormGroup.get('yieldPercentFormControl')?.value).toBe('');
    expect(dialog.accountFormGroup.get('isTaxExemptFormControl')?.value).toBeFalse();
  });
});
