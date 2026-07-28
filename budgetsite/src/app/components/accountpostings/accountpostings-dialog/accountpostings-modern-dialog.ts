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

  private dialogOpened = false;
  private initialValuesReady = false;
  private initialValuesScrolled = false;

  override ngAfterViewInit(): void {
    this.dialogRef.afterOpened().subscribe(() => {
      this.dialogOpened = true;
      this.tryScrollInitialValues();
    });

    super.ngAfterViewInit();
  }

  override async onTypeChange(firstLoad: boolean = false): Promise<void> {
    await super.onTypeChange(firstLoad);

    if (this.accountPosting.type !== 'Y' || this.accountPosting.editing) return;

    if (firstLoad) {
      this.initialValuesReady = true;
      this.tryScrollInitialValues();
      return;
    }

    this.scheduleValuesScroll();
  }

  async onModernTypeChange(): Promise<void> {
    await this.onTypeChange();
  }

  focusPrimaryValue(event: Event): void {
    event.preventDefault();
    this.primaryValueInput.nativeElement.focus();
    this.primaryValueInput.nativeElement.select();
  }

  private tryScrollInitialValues(): void {
    if (
      !this.dialogOpened ||
      !this.initialValuesReady ||
      this.initialValuesScrolled
    ) {
      return;
    }

    this.initialValuesScrolled = true;
    this.scheduleValuesScroll();
  }

  private scheduleValuesScroll(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.scrollValuesToTop());
    });
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
