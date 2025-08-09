import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  Inject,
  ChangeDetectorRef,
} from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialog,
} from '@angular/material/dialog';
import { AccountsPostings } from 'src/app/models/accountspostings.model';
import { YieldService } from 'src/app/services/yield/yield.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from 'src/app/shared/confirm-dialog/confirm-dialog.component';
import { DatepickerinputComponent } from 'src/app/shared/datepickerinput/datepickerinput.component';

@Component({
  selector: 'accountpostings-dialog',
  templateUrl: 'accountpostings-dialog.html',
})
export class AccountPostingsDialog implements OnInit, AfterViewInit {
  @ViewChild('datepickerinput') datepickerinput!: DatepickerinputComponent;

  accountPostingFormGroup = new FormGroup({
    accountIdFormControl: new FormControl('', Validators.required),
    descriptionFormControl: new FormControl('', Validators.required),
    amountFormControl: new FormControl('', Validators.required),
    noteFormControl: new FormControl(''),
    typeFormControl: new FormControl(''),
    incomeIdFormControl: new FormControl(''),
    expenseIdFormControl: new FormControl(''),
    totalBalanceFormControl: new FormControl(''),
  });

  totalBalance!: number;

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<AccountPostingsDialog>,
    @Inject(MAT_DIALOG_DATA) public accountPosting: AccountsPostings,
    private cd: ChangeDetectorRef,
    private yieldService: YieldService
  ) { }

  ngOnInit(): void { }

  ngAfterViewInit(): void {
    this.accountPosting.date = this.datepickerinput.date.value._d;
    this.cd.detectChanges();
  }

  cancel(): void {
    this.dialogRef.close();
  }

  currentDateChanged(date: Date) {
    this.accountPosting.date = date;
  }

  save(): void {
    this.dialogRef.close(this.accountPosting);
  }

  delete(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: <ConfirmDialogData>{
        title: 'Excluir Lançamento',
        message: 'Confirma a EXCLUSÃO do lançamento?',
        confirmText: 'Sim',
        cancelText: 'Cancelar',
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.accountPosting.deleting = true;

        this.dialogRef.close(this.accountPosting);
      }
    });
  }

  async onTypeChange() {
    if (this.accountPosting.type === 'Y') {
      this.accountPosting.description = 'Rendimento';

      let account = this.accountPosting.accountsList?.find((a) => a.id === this.accountPosting.accountId);

      account!.totalBalance = this.accountPosting.totalBalance;

      this.accountPosting.amount = await this.yieldService.suggestYield(account!);

    } else if (this.accountPosting.type === 'C') {
      this.accountPosting.description = 'Troco';
    } else {
      if (
        this.accountPosting.description === 'Rendimento' ||
        this.accountPosting.description === 'Troco'
      ) {
        this.accountPosting.description = '';
      }
    }
  }

  onAmountChanged(event: any): void {
    if (this.accountPosting.type !== 'Y') return;

    if (!event) {
      this.totalBalance = this.accountPosting.totalBalance;
    } else {
      this.totalBalance =
        this.accountPosting.totalBalance + this.accountPosting.amount;
    }
  }

  onTotalBalanceChanged(event: any): void {
    if (this.accountPosting.type !== 'Y') return;

    this.accountPosting.amount =
      this.totalBalance - this.accountPosting.totalBalance;
  }

  setTitle() {
    return (
      'Lançamento - ' + (this.accountPosting.editing ? 'Editar' : 'Incluir')
    );
  }
}
