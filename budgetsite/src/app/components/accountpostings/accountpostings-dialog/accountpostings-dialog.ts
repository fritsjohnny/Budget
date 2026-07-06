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
import { Messenger } from 'src/app/common/messenger';
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
    previousBusinessDayHolidayFormControl: new FormControl(false),
    noRecalculateFormControl: new FormControl(''),
    algorithmTypeFormControl: new FormControl(''),
    iofElapsedDaysFormControl: new FormControl(''),
    iofTotalFormControl: new FormControl(''),
    irTotalFormControl: new FormControl(''),
    toAccountIdFormControl: new FormControl(''),
  });

  saldoLiquido!: number;
  saldoBruto!: number;
  noRecalculate: boolean = false;
  previousBusinessDayHoliday: boolean = false;
  isCalculating: boolean = true;
  isApplyingSuggestedYield: boolean = false;

  yieldBaseCaptured: boolean = false;
  baseGrossAmount: number = 0;
  baseAmount: number = 0;
  baseSaldoBruto: number = 0;
  baseSaldoLiquido: number = 0;
  baseTotalIOF: number = 0;
  baseTotalIR: number = 0;

  iofDaysSub: any;
  accountApplications?: AccountsApplications[];

  algorithmTypes = [
    { value: '1', viewValue: 'Nubank' },
    { value: '2', viewValue: 'Neon' },
    { value: '3', viewValue: 'Mercado Pago' },
    { value: '4', viewValue: 'PicPay' },
    { value: '5', viewValue: 'PagBank' },
  ];

  readonly IOF_DAYS_STORAGE_KEY = 'budget.iofElapsedDays';
  readonly IOF_DATE_STORAGE_KEY = 'budget.iofElapsedDate';
  readonly ALGORITHM_STORAGE_KEY = 'budget.algorithmType';

  private getIofDaysKey(accountId?: number) {
    return `${this.IOF_DAYS_STORAGE_KEY}.${accountId ?? 0}`;
  }

  private getIofDateKey(accountId?: number) {
    return `${this.IOF_DATE_STORAGE_KEY}.${accountId ?? 0}`;
  }

  private getAlgorithmKey(accountId?: number) {
    return `${this.ALGORITHM_STORAGE_KEY}.${accountId ?? 0}`;
  }

  transferAccountsList: any[] = [];

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<AccountPostingsDialog>,
    @Inject(MAT_DIALOG_DATA) public accountPosting: AccountsPostings,
    private cd: ChangeDetectorRef,
    private yieldService: YieldService,
    private accountApplicationsService: AccountApplicationsService,
    private messenger: Messenger,

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

      if (!this.accountPosting.editing) {
        const accountId = this.accountPosting.accountId;

        localStorage.setItem(this.getIofDaysKey(accountId), String(days));
        localStorage.setItem(this.getIofDateKey(accountId), new Date().toISOString());
      }
    });

    this.refreshTransferAccountsList();
  }

  ngAfterViewInit(): void {
    this.accountPosting.date = this.datepickerinput.date.value._d;
    this.cd.detectChanges();

    const account = this.accountPosting.accountsList?.find(a => a.id === this.accountPosting.accountId);

    const selectedAlgorithmType = this.algorithmTypes
      .find(a => account?.name?.toLowerCase().includes(a.viewValue.toLowerCase()));

    const storedAlgorithm = localStorage.getItem(this.getAlgorithmKey(account?.id));

    if (storedAlgorithm) {
      this.accountPosting.algorithmType = storedAlgorithm;
    }
    else {
      this.accountPosting.algorithmType = selectedAlgorithmType?.value;
    }

    const control = this.accountPostingFormGroup.get('iofElapsedDaysFormControl');

    const finish = (days: number): void => {
      const normalizedDays = this.toNonNegativeInt(days);

      this.accountPosting.iofElapsedDays = normalizedDays;

      if (control) {
        control.setValue(normalizedDays, { emitEvent: false });
      }

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
    const stored = localStorage.getItem(this.getIofDaysKey(account?.id)
    );

    if (stored !== null) {
      const baseDays = this.toNonNegativeInt(Number(stored));

      const storedDateStr = localStorage.getItem(this.getIofDateKey(account?.id)
      );

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
    if (this.isTransferMode()) {
      if (!this.validateTransferMode(true)) return;
    }

    this.accountPosting.totalGrossBalance = this.saldoBruto;

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

    const accountId = this.accountPosting.accountId;

    if (accountId) {
      localStorage.setItem(
        this.getAlgorithmKey(accountId),
        this.accountPosting.algorithmType ?? ''
      );
    }

    this.onTypeChange();
  }

  onPreviousBusinessDayHolidayChanged(): void {
    if (this.accountPosting.type === 'Y' && this.accountPosting.algorithmType === '3') {
      this.onTypeChange();
    }
  }

  changeDays(delta: number): void {
    const control = this.accountPostingFormGroup.get('iofElapsedDaysFormControl');
    const value = Number(control?.value || 0);
    control?.setValue(Math.max(0, value + delta));
    this.accountPosting.iofElapsedDays = control?.value;
    this.onTypeChange();
  }

  onAccountChanged(): void {
    if (this.isTransferMode()) {
      this.refreshTransferAccountsList();
      this.applyTransferDescription();
    }
  }

  removeValidatorsAndClearFields() {
    // Remove validators temporariamente para evitar erros enquanto limpa os campos
    const amountControl = this.accountPostingFormGroup.get('amountFormControl');
    const descriptionControl = this.accountPostingFormGroup.get('descriptionFormControl');

    amountControl?.clearValidators();
    descriptionControl?.clearValidators();

    // Limpa os campos específicos dos tipos anteriores
    this.accountPosting.description = '';
    amountControl?.setValue(null);
    this.accountPosting.grossAmount = null;
    this.accountPosting.note = null;
    this.accountPosting.totalIOF = undefined;
    this.accountPosting.totalIR = undefined;

    // Restaura os validators para os campos que são obrigatórios em alguns tipos
    amountControl?.setValidators(Validators.required);
    descriptionControl?.setValidators(Validators.required);
  }

  async onTypeChange(firstLoad: boolean = false) {
    this.noRecalculate = false;
    this.isCalculating = true;

    try {

      if (!this.accountPosting.editing)
        this.removeValidatorsAndClearFields();

      if (this.accountPosting.type === 'Y') {
        this.accountPosting.description = 'Rendimento';

        let account = this.accountPosting.accountsList?.find((a) => a.id === this.accountPosting.accountId);

        account!.totalBalance = this.accountPosting.totalBalance;
        account!.totalBalanceGross = this.accountPosting.totalGrossBalance;

        this.saldoBruto = this.accountPosting.totalGrossBalance;
        this.saldoLiquido = this.accountPosting.totalBalance;

        this.saldoBruto = this.accountPosting.totalGrossBalance;
        this.saldoLiquido = this.accountPosting.totalBalance;

        if (firstLoad && this.accountPosting.editing) {
          this.captureYieldBaseValues();
          return;
        }

        let suggestYield = {
          grossYield: 0, netYield: 0, totalGross: 0, totalNet: 0, iofTotal: 0, irTotal: 0, totalAplicado: 0
        };

        if (this.accountPosting.algorithmType === '1') { // Nubank
          suggestYield = await this.yieldService.suggestYield1(account!);
        }
        else if (this.accountPosting.algorithmType === '2') { // Neon
          suggestYield = await this.yieldService.suggestYield2(account!);
        }
        else if (this.accountPosting.algorithmType === '3') { // Mercado Pago
          suggestYield = await this.yieldService.suggestYield3(
            account!,
            this.accountPosting.date,
            this.accountPosting.iofElapsedDays!,
            this.accountPosting.totalPreviousYield!,
            this.previousBusinessDayHoliday
          );
        }
        else if (this.accountPosting.algorithmType === '4') { // PicPay
          suggestYield = await this.yieldService.suggestYield4(account!, this.accountPosting.date, this.accountPosting.iofElapsedDays!, this.accountPosting.totalPreviousYield!);
        }
        else if (this.accountPosting.algorithmType === '5') { // PagBank
          suggestYield = await this.yieldService.suggestYield4(account!, this.accountPosting.date, this.accountPosting.iofElapsedDays!, this.accountPosting.totalPreviousYield!);
        }

        this.isApplyingSuggestedYield = true;

        try {
          this.accountPosting.grossAmount = suggestYield.grossYield;
          this.accountPosting.amount = suggestYield.netYield;
          this.accountPosting.totalIOF = suggestYield.iofTotal;
          this.accountPosting.totalIR = suggestYield.irTotal;

          this.saldoBruto = suggestYield.totalGross;
          this.saldoLiquido = suggestYield.totalNet;

          this.captureYieldBaseValues();

          this.cd.detectChanges();
        } finally {
          setTimeout(() => {
            this.isApplyingSuggestedYield = false;
          });
        }
      } else if (this.accountPosting.type === 'C') {
        this.accountPosting.description = 'Troco';
      } else if (this.accountPosting.type === 'T') {
        this.refreshTransferAccountsList();

        // 2) descrição automática (origem sempre “Transferido para X”)
        this.applyTransferDescription();

        // 4) valida o form para refletir required/invalid
        this.updateTransferValidators();
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

  validateTransferMode(showMessage: boolean): boolean {
    if (!this.isTransferMode()) return true;

    if (!this.accountPosting.toAccountId) {
      if (showMessage) this.messenger.message('Selecione a conta destino.');
      return false;
    }

    if (this.accountPosting.toAccountId === this.accountPosting.accountId) {
      if (showMessage) this.messenger.message('A conta destino deve ser diferente da conta de origem.');
      return false;
    }

    return true;
  }

  updateTransferValidators(): void {
    const ctrl = this.accountPostingFormGroup.get('toAccountIdFormControl');
    if (!ctrl) return;

    ctrl.setValidators([Validators.required]);
    ctrl.updateValueAndValidity({ emitEvent: false });
  }

  refreshTransferAccountsList(): void {
    const source = this.accountPosting.accountsList || [];
    const origin = this.accountPosting.accountId;

    this.transferAccountsList = origin
      ? source.filter(a => a.id !== origin)
      : source.slice(); // se ainda não tem origem, mantém todas

    if (this.accountPosting.toAccountId && this.accountPosting.toAccountId === origin) {
      this.accountPosting.toAccountId = undefined;

      const ctrl = this.accountPostingFormGroup.get('toAccountIdFormControl');
      if (ctrl) ctrl.setValue(undefined, { emitEvent: false });
    }
  }

  isTransferMode(): boolean {
    return this.accountPosting.type === 'T';
  }

  onToAccountChanged(): void {
    if (!this.isTransferMode()) return;
    this.applyTransferDescription();
  }

  applyTransferDescription(): void {
    if (!this.isTransferMode()) return;

    const destino = this.getAccountName(this.accountPosting.toAccountId);
    this.accountPosting.description = destino
      ? ('Transferido para ' + destino)
      : 'Transferência entre contas';

    const control = this.accountPostingFormGroup.get('descriptionFormControl');

    if (control) {
      control.setValue(this.accountPosting.description, { emitEvent: false });
    }
  }

  private getAccountName(accountId?: number): string {
    if (!accountId) return '';
    const account = this.accountPosting.accountsList?.find(a => a.id === accountId);
    return account?.name ?? '';
  }

  private round2(value: number): number {
    return +(Number(value || 0).toFixed(2));
  }

  private captureYieldBaseValues(): void {
    this.baseGrossAmount = this.round2(Number(this.accountPosting.grossAmount || 0));
    this.baseAmount = this.round2(Number(this.accountPosting.amount || 0));
    this.baseSaldoBruto = this.round2(Number(this.saldoBruto || 0));
    this.baseSaldoLiquido = this.round2(Number(this.saldoLiquido || 0));
    this.baseTotalIOF = this.round2(Number(this.accountPosting.totalIOF || 0));
    this.baseTotalIR = this.round2(Number(this.accountPosting.totalIR || 0));

    this.yieldBaseCaptured = true;
  }

  private ensureYieldBaseValues(): void {
    if (this.yieldBaseCaptured) return;

    this.captureYieldBaseValues();
  }

  private setControlValue(controlName: string, value: number): void {
    this.accountPostingFormGroup.get(controlName)?.setValue(value, { emitEvent: false });
  }

  private getGrossDelta(): number {
    return this.round2(Number(this.saldoBruto || 0) - this.baseSaldoBruto);
  }

  private getTaxDelta(): number {
    const iofDelta = this.round2(Number(this.accountPosting.totalIOF || 0) - this.baseTotalIOF);
    const irDelta = this.round2(Number(this.accountPosting.totalIR || 0) - this.baseTotalIR);

    return this.round2(iofDelta + irDelta);
  }

  private canRecalculateYield(): boolean {
    return this.accountPosting.type === 'Y' &&
      !this.noRecalculate &&
      !this.isCalculating &&
      !this.isApplyingSuggestedYield;
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

  onValorBrutoChanged($event: any) {
    this.calculaSaldoBruto();
    this.calculaSaldoLiquido();
    this.calculaValor();
  }

  onSaldoBrutoChanged($event: any) {
    this.calculaValorBruto();
    this.calculaSaldoLiquido();
    this.calculaValor();
  }

  onTotalIOFChanged($event: any) {
    this.calculaSaldoLiquido();
    this.calculaValor();
  }

  onTotalIRChanged($event: any) {
    this.calculaSaldoLiquido();
    this.calculaValor();
  }

  onValorChanged($event: any) {
    this.calculaSaldoLiquido(true);
  }

  onSaldoLiquidoChanged($event: any) {
    this.calculaValor();
  }

  calculaSaldoBruto(): void {
    if (!this.canRecalculateYield()) return;
    this.ensureYieldBaseValues();

    this.isCalculating = true;

    try {
      const delta = this.round2(Number(this.accountPosting.grossAmount || 0) - this.baseGrossAmount);
      const valor = this.round2(this.baseSaldoBruto + delta);

      this.saldoBruto = valor;
      this.setControlValue('totalGrossBalanceFormControl', valor);
    } finally {
      this.isCalculating = false;
    }
  }

  calculaValorBruto(): void {
    if (!this.canRecalculateYield()) return;
    this.ensureYieldBaseValues();

    this.isCalculating = true;

    try {
      const delta = this.round2(Number(this.saldoBruto || 0) - this.baseSaldoBruto);
      const valor = this.round2(this.baseGrossAmount + delta);

      this.accountPosting.grossAmount = valor;
      this.setControlValue('grossAmountFormControl', valor);
    } finally {
      this.isCalculating = false;
    }
  }

  calculaSaldoLiquido(byValor: boolean = false): void {
    if (!this.canRecalculateYield()) return;
    this.ensureYieldBaseValues();

    this.isCalculating = true;

    try {
      let valor: number;

      if (byValor) {
        const delta = this.round2(Number(this.accountPosting.amount || 0) - this.baseAmount);
        valor = this.round2(this.baseSaldoLiquido + delta);
      }
      else {
        valor = this.round2(this.baseSaldoLiquido + this.getGrossDelta() - this.getTaxDelta());
      }

      this.saldoLiquido = valor;
      this.setControlValue('totalBalanceFormControl', valor);
    } finally {
      this.isCalculating = false;
    }
  }

  calculaValor(): void {
    if (!this.canRecalculateYield()) return;
    this.ensureYieldBaseValues();

    this.isCalculating = true;

    try {
      const delta = this.round2(Number(this.saldoLiquido || 0) - this.baseSaldoLiquido);
      const valor = this.round2(this.baseAmount + delta);

      this.accountPosting.amount = valor;
      this.setControlValue('amountFormControl', valor);
    } finally {
      this.isCalculating = false;
    }
  }
}
