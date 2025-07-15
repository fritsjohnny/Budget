import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Accounts } from 'src/app/models/accounts.model';
import { AccountService } from 'src/app/services/account/account.service';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AccountDialog } from './account-dialog';
import { NotificationReader } from 'capacitor-notification-reader/src';
import { Messenger } from 'src/app/common/messenger';

@Component({
  selector: 'app-account',
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit {
  accounts?: Accounts[];
  accountsNotDisabled?: Accounts[];
  accountId?: number;
  reference?: string;
  referenceHead?: string;
  account!: Accounts;
  hideProgress: boolean = false;
  buttonName: string = '';

  constructor(
    private accountService: AccountService,
    private cd: ChangeDetectorRef,
    public dialog: MatDialog,
    private messenger: Messenger
  ) {
    this.accountId = Number(localStorage.getItem('accountId'));
  }

  ngAfterViewInit(): void {
    this.cd.detectChanges();
  }

  ngOnInit(): void {
    this.accountService.read().subscribe({
      next: (accounts) => {
        this.accounts = accounts;

        this.accounts.forEach((account) => {
          if (account.id == this.accountId) {
            this.setAccount(account);
          }
        });

        this.accountsNotDisabled = accounts?.filter(
          (account) => account.disabled == null || account.disabled == false
        );

        this.accountsNotDisabled =
          this.accountsNotDisabled.length > 0
            ? this.accountsNotDisabled.sort((a, b) => a.position! - b.position!)
            : this.accountsNotDisabled;

        this.hideProgress = true;
      },
      error: () => (this.hideProgress = true),
    });
  }

  setReference(reference: string) {
    this.reference = reference;

    this.referenceHead =
      this.reference.substr(4, 2) + '/' + this.reference.substr(0, 4);
  }

  setAccount(account: Accounts) {
    if (account) {
      this.buttonName = account.name;
      this.hideProgress = false;

      this.accountId = account.id;
      this.account = account;

      localStorage.setItem('accountId', account.id!.toString());
    }

    this.hideProgress = true;
  }

  // getAccountsNotDisabled(accounts: Accounts[]) {

  //   return accounts?.filter(account => account.disabled == null || account.disabled == false);
  // }

  drop(event: CdkDragDrop<any[]>) {
    // moveItemInArray(this.accountsNotDisabled!, event.previousIndex, event.currentIndex);

    // if (event.previousContainer === event.container) {
    moveItemInArray(
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    // } else {
    //   transferArrayItem(
    //     event.previousContainer.data,
    //     event.container.data,
    //     event.previousIndex,
    //     event.currentIndex,
    //   );
    // }
  }

  accountDialog() {
    const dialogRef = this.dialog.open(AccountDialog, {
      width: '100%',
      maxWidth: '100%',
      data: this.accounts,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.hideProgress = false;

        if (result.deleting) {
          this.accountService.delete(result.id).subscribe({
            next: () => {
              this.accounts = this.accounts!.filter((t) => t.id! != result.id!);

              if (this.accounts.length > 0) {
                this.setAccount(this.accounts[0]);
              }
            },
            error: () => (this.hideProgress = true),
          });
        } else if (result.editing) {
          this.accountService.update(result).subscribe({
            next: () => {
              this.accounts!.filter((t) => t.id! === result.id!).map((t) => {
                t.id = result.id;
                t.userId = result.userId;
                t.name = result.name;
                t.color = result.color;
                t.background = result.background;
                t.disabled = result.disabled;
                t.position = result.position;
                t.appPackageName = result.appPackageName;
                t.calcInGeneral = result.calcInGeneral;
              });

              if (result.disabled && this.accounts!.length > 0) {
                this.setAccount(this.accounts![0]);
              } else {
                this.setAccount(result);
              }

              this.ngOnInit();
            },
            error: () => (this.hideProgress = true),
          });
        } else {
          this.accountService.create(result).subscribe({
            next: (account) => {
              //this.accounts!.push(account);

              this.setAccount(account);

              this.ngOnInit();
            },
            error: () => (this.hideProgress = true),
          });
        }
      }
    });
  }

  async openBankApp(): Promise<void> {
    if (!this.account?.appPackageName) {
      console.warn('Nenhum app de banco definido para esta conta.');
      return;
    }

    try {
      await NotificationReader.openApp({
        package: this.account.appPackageName,
      });
    } catch (err) {
      this.messenger.errorHandler(err);
      console.error('Erro ao abrir o app do banco:', err);
    }
  }
}
