import { Component } from '@angular/core';
import { AccountDialog } from './account-dialog';

@Component({
  selector: 'account-modern-dialog',
  templateUrl: 'account-modern-dialog.html',
  styleUrls: [
    '../budget/budget-entry-modern-dialog.scss',
    './account-modern-dialog.scss',
  ],
})
export class AccountModernDialog extends AccountDialog { }
