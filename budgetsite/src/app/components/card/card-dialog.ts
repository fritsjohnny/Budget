import { NgxMatColorPickerComponent, Color } from '@angular-material-components/color-picker';
import { Component, OnInit, AfterViewInit, ViewChild, Inject, ChangeDetectorRef } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Cards } from 'src/app/models/cards.model';


@Component({
  selector: 'card-dialog',
  templateUrl: 'card-dialog.html',
  styleUrls: ['./card.component.scss']
})
export class CardDialog implements OnInit, AfterViewInit {

  @ViewChild('picker1') picker1!: NgxMatColorPickerComponent;
  @ViewChild('picker2') picker2!: NgxMatColorPickerComponent;

  id?: number;
  userId?: number;
  buttonName: string = "";
  buttonText: string = "Nome do Cartão";

  editing: boolean = false;
  deleting: boolean = false;

  cardFormGroup = new FormGroup({
    nameFormControl: new FormControl('', Validators.required),
    backgroundFormControl: new FormControl('', Validators.required),
    colorFormControl: new FormControl('', Validators.required),
    disabledFormControl: new FormControl(''),
    closingDayFormControl: new FormControl(''),
    dueDayFormControl: new FormControl(''),
    appPackageNameFormControl: new FormControl(''),
  });

  constructor(
    public dialogRef: MatDialogRef<CardDialog>,
    @Inject(MAT_DIALOG_DATA) public cards: Cards[],
    private cd: ChangeDetectorRef
  ) {
  }

  ngAfterViewInit(): void {

    this.addCard();
    this.cd.detectChanges();
  }

  ngOnInit(): void {
  }

  cancel(): void {

    this.dialogRef.close();
  }

  save(): void {

    let card: Cards = {
      id: this.id,
      userId: this.userId,
      name: this.cardFormGroup.get('nameFormControl')?.value,
      background: '#' + this.picker1._pickerInput.value!.hex,
      color: '#' + this.picker2._pickerInput.value!.hex,
      disabled: this.cardFormGroup.get('disabledFormControl')?.value,
      closingDay: this.cardFormGroup.get('closingDayFormControl')?.value,
      dueDay: this.cardFormGroup.get('dueDayFormControl')?.value,
      appPackageName: this.cardFormGroup.get('appPackageNameFormControl')?.value,
      editing: this.id != undefined,
      deleting: false
    };

    this.dialogRef.close(card);
  }

  delete(): void {

    let card: Cards = {
      id: this.id,
      userId: this.userId,
      name: this.cardFormGroup.get('nameFormControl')?.value,
      editing: false,
      deleting: true
    };

    this.dialogRef.close(card);
  }

  addCard() {

    this.id = undefined;

    this.cardFormGroup.get('nameFormControl')?.setValue('');
    this.cardFormGroup.get('disabledFormControl')?.setValue(false);
    this.cardFormGroup.get('calcInGeneralFormControl')?.setValue(false);

    this.setBackgroundAndColor('#000000', '#ffffff');
  }

  onNameChange(name: any) {

    this.buttonText = name != '' ? name : "Nome da Conta";
  }

  setCard(card: Cards) {
    if (card) {

      this.buttonName = card.name;

      this.id = card.id;
      this.userId = card.userId;

      this.cardFormGroup.get('nameFormControl')?.setValue(card.name);
      this.cardFormGroup.get('disabledFormControl')?.setValue(card.disabled);
      this.cardFormGroup.get('closingDayFormControl')?.setValue(card.closingDay);
      this.cardFormGroup.get('dueDayFormControl')?.setValue(card.dueDay);
      this.cardFormGroup.get('appPackageNameFormControl')?.setValue(card.appPackageName);
      this.setBackgroundAndColor(card.background!, card.color!);
    }
  }

  setBackgroundAndColor(background: string, color: string) {

    this.cardFormGroup.get('backgroundFormControl')?.setValue(background);
    this.cardFormGroup.get('colorFormControl')?.setValue(color);

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
