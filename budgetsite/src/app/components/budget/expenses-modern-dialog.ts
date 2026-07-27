import { Component, ElementRef, ViewChild } from '@angular/core';
import { ExpensesDialog } from './expenses-dialog';

@Component({
  selector: 'expenses-modern-dialog',
  templateUrl: 'expenses-modern-dialog.html',
  styleUrls: ['./budget-entry-modern-dialog.scss'],
})
export class ExpensesModernDialog extends ExpensesDialog {
  @ViewChild('totalToPayInput') private totalToPayInput!: ElementRef<HTMLInputElement>;

  focusTotalToPay(event: Event): void {
    event.preventDefault();
    this.totalToPayInput.nativeElement.focus();
    this.totalToPayInput.nativeElement.select();
  }
}
