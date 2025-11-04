import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Accounts } from 'src/app/models/accounts.model';
import { AccountService } from 'src/app/services/account/account.service';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { AccountDialog } from './account-dialog';
import { NotificationReader } from 'capacitor-notification-reader/src';
import { Messenger } from 'src/app/common/messenger';
import { delay, retryWhen, take, tap } from 'rxjs';

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

  ngOnInit(): void {
    this.refresh();
  }

  ngAfterViewInit(): void {
    this.cd.detectChanges();
  }

  refresh() {
    this.hideProgress = false;

    this.accountService.read().pipe(
      retryWhen(errors =>
        errors.pipe(
          tap((err) => console.warn('🔁 Erro ao carregar contas. Tentando novamente em 10 segundos...', err)),
          delay(10000) // 10 segundos entre tentativas infinitas
        )
      )
    ).subscribe({
      next: (accounts) => {
        this.accounts = accounts;

        this.accounts.forEach((account) => {
          if (account.id === this.accountId) {
            this.setAccount(account);
          }
        });

        this.accountsNotDisabled = accounts?.filter(
          (account) => account.disabled == null || account.disabled === false
        );

        if (this.accountsNotDisabled?.length > 0) {
          this.accountsNotDisabled.sort((a, b) => a.position! - b.position!);
        }

        this.hideProgress = true;
      },
      error: (err) => {
        // ⚠️ isso só será chamado se a stream for encerrada por erro fora do retryWhen
        console.error('Erro irrecuperável:', err);
        this.accounts = [];
        this.hideProgress = true;
      },
    });
  }

  setReference(reference: string) {
    this.reference = reference;

    this.referenceHead =
      this.reference.substr(4, 2) + '/' + this.reference.substr(0, 4);
  }

  setAccount(account: Accounts) {
    if (account) {
      this.hideProgress = false;

      this.accountId = account.id;
      this.account = account;

      localStorage.setItem('accountId', account.id!.toString());
    }

    this.hideProgress = true;
  }

  getDescription(account: Accounts): string {
    if (!account || !account.name) {
      return '';
    }

    // pega todos os "(...)" e monta a 2ª linha
    const parensMatches = account.name.match(/\([^)]*\)/g) || [];
    account.hasParens = parensMatches.length > 0;

    const secondLine = parensMatches.join(' ').trim();

    // remove todos os "(...)" do texto principal (1ª linha)
    const firstLine = account.name
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // monta o texto final com quebra de linha somente se existir conteúdo nos parênteses
    return secondLine ? `${firstLine}\n${secondLine}` : firstLine;
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
                t.irPercent = result.irPercent;
                t.yieldPercent = result.yieldPercent;
                t.isTaxExempt = result.isTaxExempt;
                t.totalBalanceGross = result.totalBalanceGross;
              });

              this.accounts = [...this.accounts!]; // nova referência para disparar change detection

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
