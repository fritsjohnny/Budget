import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CardsPostings } from 'src/app/models/cardspostings.model';

export interface CardStatementPostingPickerData {
  postings: CardsPostings[];
  statementDescription: string;
  statementAmount: number;
  statementDate: string | Date;
}

@Component({
  selector: 'app-card-statement-posting-picker-dialog',
  templateUrl: './card-statement-posting-picker-dialog.component.html',
  styleUrls: [
    '../budget/budget-entry-modern-dialog.scss',
    './card-statement-posting-picker-dialog.component.scss',
  ],
})
export class CardStatementPostingPickerDialogComponent {
  searchText = '';
  filteredPostings: CardsPostings[];

  constructor(
    private dialogRef: MatDialogRef<CardStatementPostingPickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CardStatementPostingPickerData
  ) {
    this.filteredPostings = this.sortByDateDescending(data.postings);
  }

  applyFilter(searchText: string): void {
    const search = this.normalize(searchText);
    if (!search) {
      this.filteredPostings = this.sortByDateDescending(this.data.postings);
      return;
    }

    this.filteredPostings = this.sortByDateDescending(this.data.postings.filter(posting =>
      this.normalize(posting.description).includes(search) ||
      this.formatDate(posting.date).includes(search) ||
      String(posting.amount).includes(search) ||
      posting.amount.toFixed(2).replace('.', ',').includes(search)
    ));
  }

  select(posting: CardsPostings): void {
    if (posting.id) this.dialogRef.close(posting.id);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  formatDate(value: string | Date): string {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    const date = value instanceof Date
      ? value
      : dateMatch
        ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
        : new Date(value);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  private normalize(value?: string): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  private sortByDateDescending(postings: CardsPostings[]): CardsPostings[] {
    return [...postings].sort((first, second) =>
      this.dateTimestamp(second.date) - this.dateTimestamp(first.date)
    );
  }

  private dateTimestamp(value: string | Date): number {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    const date = value instanceof Date
      ? value
      : dateMatch
        ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
        : new Date(value);
    return date.getTime();
  }
}
