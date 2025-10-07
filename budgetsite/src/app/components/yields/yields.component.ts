import { AccountPostingsService } from 'src/app/services/accountpostings/accountpostings.service';
import { Component, Inject, OnInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { AccountsYieldsDto } from 'src/app/models/accountsyields.model';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-yields',
  templateUrl: './yields.component.html',
  styleUrls: ['./yields.component.scss']
})
export class YieldsComponent implements OnInit {
  accountyields!: AccountsYieldsDto[];
  dataSource = new MatTableDataSource(this.accountyields);
  total: number = 0;
  accountYieldsLength: number = 0;

  displayedColumns = [
    'index',
    'date',
    'account',
    'amount',
    // 'dayTotal',
    'runningTotal',
  ];

  subtotalColumns = ['subtotalLabel', 'subtotalAmount', 'subtotalEmpty'];

  // aparece após a última linha de cada dia
  isEndOfDay = (index: number, row: AccountsYieldsDto): boolean => {

    if (this.data.title === 'Rendimentos da Conta') return false;

    const data = this.dataSource.data as AccountsYieldsDto[];

    if (!data?.length) return false;

    if (index === data.length - 1) return true; // última linha da tabela

    const key = (d: string | Date) =>
      typeof d === 'string' ? d.substring(0, 10) : new Date(d).toISOString().substring(0, 10);

    return key(row.date) !== key(data[index + 1].date);
  };

  minYieldData: AccountsYieldsDto | null = null;
  maxYieldData: AccountsYieldsDto | null = null;

  constructor(
    private accountPostingsService: AccountPostingsService,
    @Inject(MAT_DIALOG_DATA) public data: { reference: string | null, accountId: number | null; title: string },
    public dialogRef: MatDialogRef<YieldsComponent>) { }

  ngOnInit(): void {

    this.loadYields(this.data.reference, this.data.accountId);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  loadYields(reference: string | null, accountId: number | null) {
    this.accountPostingsService
      .getAccountsYields(reference, accountId)
      .subscribe({
        next: (accountyields) => {
          this.accountyields = accountyields;

          this.accountYieldsLength = this.accountyields.length;

          this.dataSource = new MatTableDataSource(this.accountyields);

          this.getTotalAmount();
          this.computeExtremes();
        },
        error: () => { },
      });
  }

  getTotalAmount() {
    this.total = this.accountyields
      ? this.accountyields
        .map((t) => t.amount)
        .reduce((acc, value) => acc + value, 0)
      : 0;
  }

  private computeExtremes(): void {
    const data = this.accountyields ?? [];
    if (data.length === 0) {
      this.minYieldData = null;
      this.maxYieldData = null;
      return;
    }

    // pega o primeiro como referência
    this.minYieldData = data[0];
    this.maxYieldData = data[0];

    for (const r of data) {
      if (Number(r.amount) < Number((this.minYieldData).amount)) this.minYieldData = r;
      if (Number(r.amount) > Number((this.maxYieldData).amount)) this.maxYieldData = r;
    }
  }
}
