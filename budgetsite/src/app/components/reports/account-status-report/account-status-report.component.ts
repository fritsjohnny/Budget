import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AccountsPostings } from 'src/app/models/accountspostings.model';
import { AccountPostingsService } from 'src/app/services/accountpostings/accountpostings.service';

interface AccountStatusPosting extends AccountsPostings {
  balanceAfter: number;
}

interface AccountStatusDay {
  date: Date;
  entries: number;
  exits: number;
  yields: number;
  closingBalance: number;
  postings: AccountStatusPosting[];
}

@Component({
  selector: 'app-account-status-report',
  templateUrl: './account-status-report.component.html',
  styleUrls: ['./account-status-report.component.scss']
})
export class AccountStatusReportComponent implements OnChanges {
  @Input() accountId = 0;
  @Input() initialDate: Date | null = null;
  @Input() finalDate: Date | null = null;

  accountName = '';
  loading = false;
  days: AccountStatusDay[] = [];
  openingBalance = 0;
  closingBalance = 0;
  totalEntries = 0;
  totalExits = 0;
  totalYields = 0;
  private lastRequest = 0;

  constructor(private postingsService: AccountPostingsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['accountId'] || changes['initialDate'] || changes['finalDate']) this.loadReport();
  }

  get postingCount(): number {
    return this.days.reduce((count, day) => count + day.postings.length, 0);
  }

  private loadReport(): void {
    if (!this.accountId || !this.initialDate || !this.finalDate || this.initialDate > this.finalDate) return;
    const request = ++this.lastRequest;
    this.loading = true;
    this.days = [];
    this.totalEntries = this.totalExits = this.totalYields = 0;
    forkJoin({
      postings: this.postingsService.readByDateRange(this.accountId, this.initialDate, this.finalDate),
      opening: this.postingsService.getHistoricalBalance(this.accountId, this.initialDate)
    })
      .pipe(finalize(() => {
      if (request === this.lastRequest) this.loading = false;
    })).subscribe({
      next: ({ postings, opening }) => {
        if (request !== this.lastRequest) return;
        const openingBalance = Number(opening?.balance ?? 0);
        this.accountName = postings.find(posting => posting.account?.id === this.accountId)?.account?.name || '';
        const initial = this.startOfDay(this.initialDate!);
        const final = this.startOfDay(this.finalDate!);
        const periodPostings = (postings ?? []).filter(posting => {
          const date = this.localDate(posting.date);
          return date >= initial && date <= final;
        });
        const ordered = periodPostings.slice().sort((a, b) => this.postingDay(b) - this.postingDay(a) || Number(b.position ?? 0) - Number(a.position ?? 0));
        const grouped = new Map<string, AccountStatusDay>();
        let balance = openingBalance;

        this.openingBalance = openingBalance;

        ordered.slice().reverse().forEach(posting => {
          const date = this.localDate(posting.date);
          const key = this.dayKey(date);
          const amount = Number(posting.amount ?? 0);
          const isYield = posting.type?.toUpperCase() === 'Y';
          balance = this.applyPosting(balance, posting);
          let day = grouped.get(key);
          if (!day) {
          day = { date, entries: 0, exits: 0, yields: 0, closingBalance: 0, postings: [] };
            grouped.set(key, day);
          }
          if (isYield) day.yields = this.roundMoney(day.yields + amount);
          else if (amount > 0) day.entries = this.roundMoney(day.entries + amount);
          else if (amount < 0) day.exits = this.roundMoney(day.exits + Math.abs(amount));
          day.closingBalance = balance;
          day.postings.push({ ...posting, balanceAfter: balance });
        });

        const allDays = Array.from(grouped.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
        allDays.forEach(day => day.postings.reverse());
        this.days = allDays;
        this.totalEntries = this.roundMoney(this.days.reduce((sum, day) => sum + day.entries, 0));
        this.totalExits = this.roundMoney(this.days.reduce((sum, day) => sum + day.exits, 0));
        this.totalYields = this.roundMoney(this.days.reduce((sum, day) => sum + day.yields, 0));
        this.closingBalance = this.days.length ? this.days[0].closingBalance : this.openingBalance;
      },
      error: () => {
        if (request === this.lastRequest) this.days = [];
      }
    });
  }

  trackByDate(_index: number, day: AccountStatusDay): string {
    const date = day.date;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  formatSignedAmount(value: number): string { return `${value < 0 ? '−' : '+'} ${Math.abs(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`; }
  private postingDay(posting: AccountsPostings): number { return this.localDate(posting.date).getTime(); }
  private applyPosting(currentBalance: number, posting: AccountsPostings): number {
    return this.roundMoney(currentBalance + Number(posting.amount ?? 0));
  }
  private localDate(value: Date | string): Date {
    if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  }
  private startOfDay(value: Date): Date { return new Date(value.getFullYear(), value.getMonth(), value.getDate()); }
  private dayKey(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private roundMoney(value: number): number { return Math.round((value + Number.EPSILON) * 100) / 100; }
}
