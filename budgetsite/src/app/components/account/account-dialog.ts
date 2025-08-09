import { NgxMatColorPickerComponent, Color } from '@angular-material-components/color-picker';
import { Component, OnInit, AfterViewInit, ViewChild, Inject, ChangeDetectorRef } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Accounts } from 'src/app/models/accounts.model';


@Component({
  selector: 'account-dialog',
  templateUrl: 'account-dialog.html',
  styleUrls: ['./account.component.scss']
})
export class AccountDialog implements OnInit, AfterViewInit {

  @ViewChild('picker1') picker1!: NgxMatColorPickerComponent;
  @ViewChild('picker2') picker2!: NgxMatColorPickerComponent;

  id?: number;
  userId!: number;
  buttonName: string = "";
  buttonText: string = "Nome da Conta";

  editing: boolean = false;
  deleting: boolean = false;

  accountFormGroup = new FormGroup({
    nameFormControl: new FormControl('', Validators.required),
    backgroundFormControl: new FormControl('', Validators.required),
    colorFormControl: new FormControl('', Validators.required),
    disabledFormControl: new FormControl(''),
    calcInGeneralFormControl: new FormControl(''),
    positionFormControl: new FormControl(''),
    appPackageNameFormControl: new FormControl(''),
    yieldPercentFormControl: new FormControl(''),
    irPercentFormControl: new FormControl(''),
    isTaxExemptFormControl: new FormControl(false),
    totalBalanceGrossFormControl: new FormControl(''),
  });

  constructor(
    public dialogRef: MatDialogRef<AccountDialog>,
    @Inject(MAT_DIALOG_DATA) public accounts: Accounts[],
    private cd: ChangeDetectorRef
  ) {
  }

  ngAfterViewInit(): void {

    this.addAccount();
    this.cd.detectChanges();
  }

  ngOnInit(): void {
  }

  cancel(): void {

    this.dialogRef.close();
  }

  save(): void {

    let account: Accounts = {
      id: this.id,
      userId: this.userId,
      name: this.accountFormGroup.get('nameFormControl')?.value,
      background: '#' + this.picker1._pickerInput.value!.hex,
      color: '#' + this.picker2._pickerInput.value!.hex,
      disabled: this.accountFormGroup.get('disabledFormControl')?.value,
      calcInGeneral: this.accountFormGroup.get('calcInGeneralFormControl')?.value,
      position: this.accountFormGroup.get('positionFormControl')?.value,
      appPackageName: this.accountFormGroup.get('appPackageNameFormControl')?.value,
      yieldPercent: parseFloat(this.accountFormGroup.get('yieldPercentFormControl')?.value?.toString().replace(',', '.') ?? '0'),
      irPercent: parseFloat(this.accountFormGroup.get('irPercentFormControl')?.value?.toString().replace(',', '.') ?? '0'),
      isTaxExempt: this.accountFormGroup.get('isTaxExemptFormControl')?.value,
      totalBalanceGross: parseFloat(this.accountFormGroup.get('totalBalanceGrossFormControl')?.value?.toString().replace(',', '.') ?? '0'),
      editing: this.id != undefined,
      deleting: false
    };

    this.dialogRef.close(account);
  }

  delete(): void {

    let account: Accounts = {
      id: this.id,
      userId: this.userId,
      name: this.accountFormGroup.get('nameFormControl')?.value,
      editing: false,
      deleting: true
    };

    this.dialogRef.close(account);
  }

  addAccount() {

    this.id = undefined;

    this.accountFormGroup.get('nameFormControl')?.setValue('');
    this.accountFormGroup.get('disabledFormControl')?.setValue(false);
    this.accountFormGroup.get('calcInGeneralFormControl')?.setValue(false);

    this.setBackgroundAndColor('#000000', '#ffffff');
  }

  onNameChange(name: any) {

    this.buttonText = name != '' ? name : "Nome da Conta";
  }

  setAccount(account: Accounts) {

    if (account) {

      this.buttonName = account.name;

      this.id = account.id;
      this.userId = account.userId;

      this.accountFormGroup.get('nameFormControl')?.setValue(account.name);
      this.accountFormGroup.get('disabledFormControl')?.setValue(account.disabled);
      this.accountFormGroup.get('calcInGeneralFormControl')?.setValue(account.calcInGeneral);
      this.accountFormGroup.get('positionFormControl')?.setValue(account.position);
      this.accountFormGroup.get('appPackageNameFormControl')?.setValue(account.appPackageName);
      this.accountFormGroup.get('yieldPercentFormControl')?.setValue(account.yieldPercent);
      this.accountFormGroup.get('irPercentFormControl')?.setValue(account.irPercent);
      this.accountFormGroup.get('isTaxExemptFormControl')?.setValue(account.isTaxExempt);
      this.accountFormGroup.get('totalBalanceGrossFormControl')?.setValue(account.totalBalanceGross);

      this.setBackgroundAndColor(account.background!, account.color!);
    }
  }

  setBackgroundAndColor(background: string, color: string) {

    this.accountFormGroup.get('backgroundFormControl')?.setValue(background);
    this.accountFormGroup.get('colorFormControl')?.setValue(color);

    const color1 = this.hexToRgb(background);
    const color2 = this.hexToRgb(color);

    this.picker1._pickerInput.value = new Color(color1!.r, color1!.g, color1!.b);
    this.picker2._pickerInput.value = new Color(color2!.r, color2!.g, color2!.b);
  }

  hexToRgb(hex: string) {

    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;

    hex = hex.replace(shorthandRegex, (m, r, g, b) => {
      return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
}
