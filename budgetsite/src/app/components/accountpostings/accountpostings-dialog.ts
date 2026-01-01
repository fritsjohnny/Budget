import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  Inject,
  ChangeDetectorRef,
  OnDestroy,
} from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialog,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { AccountsApplications } from 'src/app/models/accountsapplications.model';
import { AccountsPostings } from 'src/app/models/accountspostings.model';
import { AccountApplicationsService } from 'src/app/services/accountapplications/accountapplications.service';
import { YieldService } from 'src/app/services/yield/yield.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from 'src/app/shared/confirm-dialog/confirm-dialog.component';
import { DatepickerinputComponent } from 'src/app/shared/datepickerinput/datepickerinput.component';

@Component({
  selector: 'accountpostings-dialog',
  templateUrl: 'accountpostings-dialog.html',
  styleUrls: ['accountpostings-dialog.scss'],
})
export class AccountPostingsDialog implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('datepickerinput') datepickerinput!: DatepickerinputComponent;

  accountPostingFormGroup = new FormGroup({
    accountIdFormControl: new FormControl('', Validators.required),
    descriptionFormControl: new FormControl('', Validators.required),
    amountFormControl: new FormControl('', Validators.required),
    grossAmountFormControl: new FormControl(''),
    noteFormControl: new FormControl(''),
    typeFormControl: new FormControl(''),
    incomeIdFormControl: new FormControl(''),
    expenseIdFormControl: new FormControl(''),
    totalBalanceFormControl: new FormControl(''),
    totalGrossBalanceFormControl: new FormControl(''),
    noRecalculateFormControl: new FormControl(''),
    algorithmTypeFormControl: new FormControl(''),
    iofElapsedDaysFormControl: new FormControl(''),
    iofTotalFormControl: new FormControl(''),
    irTotalFormControl: new FormControl(''),
  });

  totalBalance!: number;
  totalGrossBalance!: number;
  noRecalculate: boolean = false;
  isCalculating: boolean = true;

  iofDaysSub: any;
  accountApplications?: AccountsApplications[];

  algorithmTypes = [
    { value: '1', viewValue: 'Nubank' },
    { value: '2', viewValue: 'Neon' },
    { value: '3', viewValue: 'Mercado Pago' },
    { value: '4', viewValue: 'PicPay' },
  ];

  readonly IOF_DAYS_STORAGE_KEY = 'budget.iofElapsedDays';
  readonly IOF_DATE_STORAGE_KEY = 'budget.iofElapsedDate';

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<AccountPostingsDialog>,
    @Inject(MAT_DIALOG_DATA) public accountPosting: AccountsPostings,
    private cd: ChangeDetectorRef,
    private yieldService: YieldService,
    private accountApplicationsService: AccountApplicationsService
  ) { }

  ngOnInit(): void {
    this.algorithmTypes = this.algorithmTypes
      .sort((a, b) => a.viewValue.localeCompare(b.viewValue));

    const control = this.accountPostingFormGroup.get('iofElapsedDaysFormControl');

    if (!control) return;

    this.iofDaysSub = control.valueChanges.subscribe(value => {
      const days = this.toNonNegativeInt(value);

      if (days !== value) {
        control.setValue(days, { emitEvent: false });
      }

      this.accountPosting.iofElapsedDays = days;
    });
  }

  ngAfterViewInit(): void {
    this.accountPosting.date = this.datepickerinput.date.value._d;
    this.cd.detectChanges();

    const account = this.accountPosting.accountsList?.find(a => a.id === this.accountPosting.accountId);

    const selectedAlgorithmType = this.algorithmTypes
      .find(a => account?.name?.toLowerCase().includes(a.viewValue.toLowerCase()));

    this.accountPosting.algorithmType = selectedAlgorithmType?.value;

    const control = this.accountPostingFormGroup.get('iofElapsedDaysFormControl');

    const finish = (days: number): void => {
      if (control) { control.setValue(this.toNonNegativeInt(days)); }
      this.isCalculating = false;
      this.onTypeChange(true);
    };

    if (!control) {
      this.isCalculating = false;
      this.onTypeChange(true); // ✅ garante também aqui
      return;
    }

    if (this.accountPosting.editing && this.accountPosting.iofElapsedDays !== undefined) {
      finish(this.accountPosting.iofElapsedDays);
      return;
    }
    
    // 1) localStorage
    const stored = localStorage.getItem(this.IOF_DAYS_STORAGE_KEY);

    if (stored !== null) {
      const baseDays = this.toNonNegativeInt(Number(stored));

      const storedDateStr = localStorage.getItem(this.IOF_DATE_STORAGE_KEY);
      if (!storedDateStr) {
        finish(baseDays);
        return;
      }

      const storedDate = new Date(storedDateStr);
      const today = new Date();

      today.setHours(0, 0, 0, 0);
      storedDate.setHours(0, 0, 0, 0);

      const diff = Math.floor((today.getTime() - storedDate.getTime()) / 86400000);
      finish(baseDays + Math.max(0, diff));
      return;
    }

    // 2) fallback: readByAccount
    if (!account?.id) {
      finish(0);
      return;
    }

    firstValueFrom(this.accountApplicationsService.readByAccount(account.id))
      .then(apps => {
        if (apps?.length && apps[0]?.dateApplied) {
          this.accountApplications = apps;

          const today = new Date();
          const applied = new Date(apps[0].dateApplied);
          const days = Math.floor((today.getTime() - applied.getTime()) / 86400000);

          finish(days);
          return;
        }

        finish(0);
      })
      .catch(() => finish(0));
  }

  cancel(): void {
    this.dialogRef.close();
  }

  currentDateChanged(date: Date) {
    debugger;
    date.setHours(0, 0, 0, 0);
    this.accountPosting.date.setHours(0, 0, 0, 0);

    let diff = Math.floor((new Date(date).getTime() - new Date(this.accountPosting.date).getTime()) / 86400000);

    this.changeDays(diff);

    this.accountPosting.date = date;

    // recalcula total de rendimentos até a data do lançamento
    this.accountPosting.totalYields = this.accountPosting.accountPostingsYields
      ?.filter(ap => new Date(ap.date) < new Date(this.accountPosting.date))
      .reduce((sum, ap) => +(sum + ap.amount).toFixed(2), 0) ?? 0;

    if (this.accountPosting.type === 'Y') {
      this.onTypeChange();
    }
  }

  save(): void {
    this.accountPosting.totalGrossBalance = this.totalGrossBalance;

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

  onAlgorithmTypeChange(value: any) {
    this.onTypeChange();
  }

  changeDays(delta: number): void {
    const control = this.accountPostingFormGroup.get('iofElapsedDaysFormControl');
    const value = Number(control?.value || 0);
    control?.setValue(Math.max(0, value + delta));
    this.accountPosting.iofElapsedDays = control?.value;
    this.onTypeChange();
  }

  async onTypeChange(firstLoad: boolean = false) {
    this.noRecalculate = false;
    this.isCalculating = true;

    try {
      if (this.accountPosting.type === 'Y') {
        this.accountPosting.description = 'Rendimento';

        let account = this.accountPosting.accountsList?.find((a) => a.id === this.accountPosting.accountId);

        account!.totalBalance = this.accountPosting.totalBalance;
        account!.totalBalanceGross = this.accountPosting.totalGrossBalance;

        this.totalGrossBalance = this.accountPosting.totalGrossBalance;
        this.totalBalance = this.accountPosting.totalBalance;

        if (firstLoad && this.accountPosting.editing) return;

        let suggestYield = {
          grossYield: 0, netYield: 0, totalGross: 0, totalNet: 0, iofTotal: 0, irTotal: 0
        };

        if (this.accountPosting.algorithmType === '1') { // Nubank
          suggestYield = await this.yieldService.suggestYield1(account!);
        }
        else if (this.accountPosting.algorithmType === '2') { // Neon
          suggestYield = await this.yieldService.suggestYield2(account!);
        }
        else if (this.accountPosting.algorithmType === '3') { // Mercado Pago
          suggestYield = await this.yieldService.suggestYield3(account!);
        }
        else if (this.accountPosting.algorithmType === '4') { // PicPay
          suggestYield = await this.yieldService.suggestYield4(account!, this.accountPosting.date, this.accountPosting.totalYields!, this.accountPosting.iofElapsedDays!);
        }

        this.accountPosting.grossAmount = suggestYield.grossYield;
        this.accountPosting.amount = suggestYield.netYield;
        this.accountPosting.totalIOF = suggestYield.iofTotal;
        this.accountPosting.totalIR = suggestYield.irTotal;

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
    } finally {
      this.isCalculating = false;
    }
  }

  onAmountChanged(event: any): void {
    if (this.accountPosting.type !== 'Y' || this.noRecalculate || this.isCalculating) return;

    if (!event) {
      this.totalBalance = this.accountPosting.totalBalance;
    } else {
      this.totalBalance =
        +(this.accountPosting.totalBalance + this.accountPosting.amount - (this.accountPosting.editing ? this.accountPosting.originalAmount ?? 0 : 0)).toFixed(2);
    }
  }

  onGrossAmountChanged(event: any): void {
    if (this.accountPosting.type !== 'Y' || this.noRecalculate || this.isCalculating) return;

    if (!event) {
      this.totalGrossBalance = this.accountPosting.totalGrossBalance;
    } else {
      this.totalGrossBalance =
        +(this.accountPosting.totalGrossBalance + this.accountPosting.grossAmount - (this.accountPosting.editing ? this.accountPosting.originalGrossAmount ?? 0 : 0)).toFixed(2);
    }
  }

  onTotalBalanceChanged(event: any): void {
    if (this.accountPosting.type !== 'Y' || this.noRecalculate || this.isCalculating) return;

    this.accountPosting.amount =
      +(this.totalBalance - this.accountPosting.totalBalance + (this.accountPosting.editing ? this.accountPosting.originalAmount ?? 0 : 0)).toFixed(2);
  }

  onTotalGrossBalanceChanged(event: any): void {
    if (this.accountPosting.type !== 'Y' || this.noRecalculate || this.isCalculating) return;

    this.accountPosting.grossAmount =
      +(this.totalGrossBalance - this.accountPosting.totalGrossBalance + (this.accountPosting.editing ? this.accountPosting.originalGrossAmount ?? 0 : 0)).toFixed(2);

    this.calcAmount();
  }

  onIofTotalChanged(): void {
    this.calcAmount();
  }

  onIrTotalChanged(): void {
    this.calcAmount();
  }

  calcAmount() {
    if (this.accountPosting.type !== 'Y' || this.noRecalculate || this.isCalculating || this.accountPosting.algorithmType !== '4') return;

    this.accountPosting.amount =
      +(this.totalGrossBalance - this.accountPosting.totalBalance - this.accountPosting.totalIOF! - this.accountPosting.totalIR!).toFixed(2);
  }

  setTitle() {
    return (
      'Lançamento - ' + (this.accountPosting.editing ? 'Editar' : 'Incluir')
    );
  }

  toNonNegativeInt(value: any): number {
    const n = Number(value);
    if (isNaN(n)) return 0;
    return Math.max(0, Math.trunc(n));
  }

  ngOnDestroy(): void {
    if (this.iofDaysSub) { this.iofDaysSub.unsubscribe(); }
  }
}
