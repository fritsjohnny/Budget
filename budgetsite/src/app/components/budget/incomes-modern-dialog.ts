import { Component, ElementRef, ViewChild } from '@angular/core';
import { IncomesDialog } from './incomes-dialog';

@Component({
  selector: 'incomes-modern-dialog',
  templateUrl: 'incomes-modern-dialog.html',
  styleUrls: ['./budget-entry-modern-dialog.scss'],
})
export class IncomesModernDialog extends IncomesDialog {
  @ViewChild('totalToReceiveInput') private totalToReceiveInput!: ElementRef<HTMLInputElement>;

  focusTotalToReceive(event: Event): void {
    event.preventDefault();
    this.totalToReceiveInput.nativeElement.focus();
    this.totalToReceiveInput.nativeElement.select();
  }
}
