import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface PhysicalCardDialogData {
  cardName: string;
  nameOnCard: string;
  lastFourDigits: string;
  editing: boolean;
}

@Component({
  selector: 'app-physical-card-dialog',
  templateUrl: './physical-card-dialog.component.html',
  styleUrls: ['./physical-card-dialog.component.scss'],
})
export class PhysicalCardDialogComponent implements OnInit {
  form = new FormGroup({
    nameOnCard: new FormControl('', Validators.required),
    lastFourDigits: new FormControl('', [Validators.required, Validators.pattern(/^\d{4}$/)]),
  });

  constructor(
    public dialogRef: MatDialogRef<PhysicalCardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: PhysicalCardDialogData,
  ) {}

  ngOnInit(): void {
    this.form.patchValue({ nameOnCard: this.data.nameOnCard, lastFourDigits: this.data.lastFourDigits });
    if (localStorage.getItem('budgetLayout') === 'modern') {
      this.dialogRef.addPanelClass(['modern-aux-dialog-panel', 'modern-physical-card-dialog-panel']);
    }
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close({
      nameOnCard: String(this.form.value.nameOnCard ?? '').trim(),
      lastFourDigits: String(this.form.value.lastFourDigits ?? '').trim(),
    });
  }
}
