import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-addvalue',
  templateUrl: './addvalue.component.html',
  styleUrls: ['./addvalue.component.scss'],
})
export class AddvalueComponent implements OnInit {
  addValueFormGroup = new FormGroup({
    amountFormControl: new FormControl('', Validators.required),
  });

  isNegative = false;
  suggestedValues = [1, 3, 5, 10, 50, 100];

  constructor(
    public dialogRef: MatDialogRef<AddvalueComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddvalueData
  ) {}

  ngOnInit(): void {}

  cancel(): void {
    this.dialogRef.close();
  }

  setTitle() {
    return this.data.description;
  }

  save(): void {}

  setPositiveOrNegative() {
    this.data.amount = this.data.amount * -1;
    this.isNegative = !this.isNegative;
  }

  setSuggestedAmount(suggestedAmount: number) {
    const value = this.isNegative ? -suggestedAmount : suggestedAmount;

    this.data.amount = isNaN(this.data.amount)
      ? value
      : this.data.amount + value;
  }
}

export interface AddvalueData {
  id: number;
  description: string;
  amount: number;
  type: string;
}
