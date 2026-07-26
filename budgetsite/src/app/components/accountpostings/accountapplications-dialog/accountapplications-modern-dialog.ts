import { Component } from '@angular/core';
import { AccountApplicationsDialog } from './accountapplications-dialog';

@Component({
  selector: 'accountapplications-modern-dialog',
  templateUrl: 'accountapplications-modern-dialog.html',
  styleUrls: [
    '../../budget/budget-entry-modern-dialog.scss',
    '../account-entry-modern-dialog.scss',
  ],
})
export class AccountApplicationsModernDialog extends AccountApplicationsDialog { }
