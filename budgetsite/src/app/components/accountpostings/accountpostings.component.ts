import { Component, OnInit, Input, OnChanges, SimpleChanges, SimpleChange } from '@angular/core';
import { AccountsPostings } from '../../models/accountspostings.model'
import { AccountPostingsService } from '../../services/accountpostings/accountpostings.service';

@Component({
  selector: 'app-accountpostings',
  templateUrl: './accountpostings.component.html',
  styleUrls: ['./accountpostings.component.css']
})
export class AccountPostingsComponent implements OnInit {

  @Input() accountId?: number;
  @Input() reference?: string;

  accountpostings!: AccountsPostings[];

  displayedColumns = ['date', 'description', 'amount'];

  constructor(private accountPostingsService: AccountPostingsService) { }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges): void {

    // if (changes['accountId']?.currentValue || changes['reference']?.currentValue) {
    if (this.accountId) {

      this.accountPostingsService.read(this.accountId!, this.reference!).subscribe(accountpostings => {
        this.accountpostings = accountpostings;
      });
    }
  }
}
