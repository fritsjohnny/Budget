import { Component, ElementRef, ViewChild } from '@angular/core';
import { AccountPostingsDialog } from './accountpostings-dialog';

@Component({
  selector: 'accountpostings-modern-dialog',
  templateUrl: 'accountpostings-modern-dialog.html',
  styleUrls: [
    '../../budget/budget-entry-modern-dialog.scss',
    '../account-entry-modern-dialog.scss',
  ],
})
export class AccountPostingsModernDialog extends AccountPostingsDialog {
  @ViewChild('dialogContent') private dialogContent!: ElementRef<HTMLElement>;
  @ViewChild('primaryValueInput') private primaryValueInput!: ElementRef<HTMLInputElement>;
  @ViewChild('valuesSection') private valuesSection!: ElementRef<HTMLElement>;

  async onModernTypeChange(): Promise<void> {
    await this.onTypeChange();

    if (this.accountPosting.type !== 'Y') return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.scrollValuesToTop());
    });
  }

  focusPrimaryValue(event: Event): void {
    event.preventDefault();
    this.primaryValueInput.nativeElement.focus();
    this.primaryValueInput.nativeElement.select();
  }

  private scrollValuesToTop(): void {
    const content = this.dialogContent?.nativeElement;
    const values = this.valuesSection?.nativeElement;

    if (!content || !values) return;

    const contentTop = content.getBoundingClientRect().top;
    const valuesTop = values.getBoundingClientRect().top;
    const targetTop = content.scrollTop + valuesTop - contentTop;

    content.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
  }
}
