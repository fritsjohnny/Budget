import { Component } from '@angular/core';
import { AccountPostingsDialog } from './accountpostings-dialog';

@Component({
  selector: 'accountpostings-modern-dialog',
  templateUrl: 'accountpostings-modern-dialog.html',
  styleUrls: [
    '../../budget/budget-entry-modern-dialog.scss',
    '../account-entry-modern-dialog.scss',
  ],
})
export class AccountPostingsModernDialog extends AccountPostingsDialog { }
