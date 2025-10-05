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
    'dayTotal',
    'runningTotal',
  ];

  constructor(
    private accountPostingsService: AccountPostingsService,
    @Inject(MAT_DIALOG_DATA) public data: { reference: string | null, accountId: number | null; },
    public dialogRef: MatDialogRef<YieldsComponent>) { }

  ngOnInit(): void {

    this.loadYields(this.data.reference, this.data.accountId);
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
}
