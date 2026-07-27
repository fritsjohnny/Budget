import { Component, ElementRef, ViewChild } from '@angular/core';
import { CardPostingsDialog } from './cardpostings-dialog';
@Component({ selector: 'cardpostings-modern-dialog', templateUrl: 'cardpostings-modern-dialog.html', styleUrls: ['../../budget/budget-entry-modern-dialog.scss', '../card-entry-modern-dialog.scss'] })
export class CardPostingsModernDialog extends CardPostingsDialog {
  @ViewChild('totalAmountInput') private totalAmountInput!: ElementRef<HTMLInputElement>;

  focusTotalAmount(event: Event): void {
    event.preventDefault();
    this.totalAmountInput.nativeElement.focus();
    this.totalAmountInput.nativeElement.select();
  }
}
