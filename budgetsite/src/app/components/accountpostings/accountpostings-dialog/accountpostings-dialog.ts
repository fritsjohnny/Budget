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
import { AccountsPostings, AccountsPostingApplicationDetail } from 'src/app/models/accountspostings.model';
import { AccountApplicationsService } from 'src/app/services/accountapplications/accountapplications.service';
import { AccountHistoricalBalance, AccountPostingsService } from 'src/app/services/accountpostings/accountpostings.service';
import { AccountService } from 'src/app/services/account/account.service';
import { YieldService } from 'src/app/services/yield/yield.service';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from 'src/app/shared/confirm-dialog/confirm-dialog.component';
import { DatepickerinputComponent } from 'src/app/shared/datepickerinput/datepickerinput.component';
import { Accounts } from 'src/app/models/accounts.model';

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

  private initialCurrentBalanceForYield: number = 0;
  private initialCurrentGrossBalanceForYield: number = 0;
  private dateChangeRequestId: number = 0;
  private isHistoricalBalanceForYield: boolean = false;

  yieldBaseCaptured: boolean = false;
  baseGrossAmount: number = 0;
  baseAmount: number = 0;
  baseSaldoBruto: number = 0;
  baseSaldoLiquido: number = 0;
  baseTotalIOF: number = 0;
  baseTotalIR: number = 0;

  iofDaysSub: any;
  accountApplications?: AccountsApplications[];
  applicationDetails: AccountsPostingApplicationDetail[] = [];

  get hasMultipleApplications(): boolean {
    return this.applicationDetails.length > 1
      || (this.accountPosting.applicationDetails?.length ?? 0) > 1
      || this.getYieldApplications().length > 1;
  }

  private getYieldApplications(): AccountsApplications[] {
    const launchDate = new Date(this.accountPosting.date);
    launchDate.setHours(0, 0, 0, 0);

    return (this.accountApplications ?? [])
      .filter(application => {
        if (application.disabled || !application.id || Number(application.amountApplied || 0) <= 0) return false;

        const appliedDate = new Date(application.dateApplied);
        appliedDate.setHours(0, 0, 0, 0);
        if (appliedDate > launchDate) return false;
        if (!application.maturityDate) return true;
        const maturityDate = new Date(application.maturityDate);
        maturityDate.setHours(0, 0, 0, 0);
        return maturityDate >= launchDate;
      })
      .sort((a, b) => new Date(a.dateApplied).getTime() - new Date(b.dateApplied).getTime())
      .filter((application, index, applicationsList) =>
        applicationsList.findIndex(item => item.id === application.id) === index
      );
  }

  private applicationDetailsLoadedFromServer = false;
  private applicationBaseValues = new Map<number, {
    grossAmount: number;
    amount: number;
    totalGrossBalance: number;
    totalBalance: number;
    totalIOF: number;
    totalIR: number;
  }>();
  private applicationHistoricalBalanceCache = new Map<string, Promise<AccountHistoricalBalance>>();

  get consolidatedGross(): number {
    return this.round2(this.applicationDetails.reduce((sum, detail) => sum + Number(detail.grossAmount ?? 0), 0));
  }

  get consolidatedIOF(): number {
    return this.round2(this.applicationDetails.reduce((sum, detail) => sum + Number(detail.totalIOF ?? 0), 0));
  }

  get consolidatedIR(): number {
    return this.round2(this.applicationDetails.reduce((sum, detail) => sum + Number(detail.totalIR ?? 0), 0));
  }

  get consolidatedAmount(): number {
    return this.round2(this.applicationDetails.reduce((sum, detail) => sum + Number(detail.amount ?? 0), 0));
  }

  get consolidatedNetBalance(): number {
    return this.round2(this.applicationDetails.reduce((sum, detail) => sum + Number(detail.totalBalance ?? 0), 0));
  }

  applicationLabel(id: number): string {
    const app = this.accountApplications?.find(x => x.id === id);
    if (!app) return 'Aplicação ' + id;
    return new Date(app.dateApplied).toLocaleDateString('pt-BR') + ' - ' +
      Number(app.amountApplied).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  recalculateApplicationTotals(): void {
    if (this.applicationDetails.length === 0) return;

    const consolidatedGrossBalance = this.round2(
      this.applicationDetails.reduce((sum, detail) => sum + Number(detail.totalGrossBalance ?? 0), 0)
    );
    const consolidatedNetBalance = this.consolidatedNetBalance;

    this.accountPosting.amount = this.consolidatedAmount;
    this.accountPosting.grossAmount = this.consolidatedGross;
    this.accountPosting.totalIOF = this.consolidatedIOF;
    this.accountPosting.totalIR = this.consolidatedIR;
    this.accountPosting.totalGrossBalance = consolidatedGrossBalance;
    this.accountPosting.totalBalance = consolidatedNetBalance;

    this.saldoBruto = consolidatedGrossBalance;
    this.saldoLiquido = consolidatedNetBalance;
  }
  private captureApplicationBaseValues(): void {
    this.applicationBaseValues.clear();

    for (const detail of this.applicationDetails) {
      this.applicationBaseValues.set(detail.accountApplicationId, {
        grossAmount: this.round2(Number(detail.grossAmount ?? 0)),
        amount: this.round2(Number(detail.amount ?? 0)),
        totalGrossBalance: this.round2(Number(detail.totalGrossBalance ?? 0)),
        totalBalance: this.round2(Number(detail.totalBalance ?? 0)),
        totalIOF: this.round2(Number(detail.totalIOF ?? 0)),
        totalIR: this.round2(Number(detail.totalIR ?? 0)),
      });
    }
  }

  private recalculateApplicationDetail(
    detail: AccountsPostingApplicationDetail,
    changedField: 'grossAmount' | 'amount' | 'totalGrossBalance' | 'totalBalance' | 'totalIOF' | 'totalIR'
  ): void {
    const base = this.applicationBaseValues.get(detail.accountApplicationId);
    if (!base) {
      this.captureApplicationBaseValues();
      return;
    }

    const currentGrossAmount = this.round2(Number(detail.grossAmount ?? 0));
    const currentAmount = this.round2(Number(detail.amount ?? 0));
    const currentGrossBalance = this.round2(Number(detail.totalGrossBalance ?? 0));
    const currentBalance = this.round2(Number(detail.totalBalance ?? 0));
    const currentIOF = this.round2(Number(detail.totalIOF ?? 0));
    const currentIR = this.round2(Number(detail.totalIR ?? 0));

    let grossDelta = this.round2(currentGrossAmount - base.grossAmount);

    if (changedField === 'totalGrossBalance') {
      grossDelta = this.round2(currentGrossBalance - base.totalGrossBalance);
      detail.grossAmount = this.round2(base.grossAmount + grossDelta);
    }
    else if (changedField === 'grossAmount') {
      detail.totalGrossBalance = this.round2(base.totalGrossBalance + grossDelta);
    }

    let calculatedBalance: number;
    if (changedField === 'amount') {
      calculatedBalance = this.round2(base.totalBalance + currentAmount - base.amount);
    }
    else if (changedField === 'totalBalance') {
      calculatedBalance = currentBalance;
    }
    else {
      calculatedBalance = this.round2(
        base.totalBalance
        + grossDelta
        - (currentIOF - base.totalIOF)
        - (currentIR - base.totalIR)
      );
      detail.totalBalance = calculatedBalance;
    }

    if (changedField === 'amount') {
      detail.totalBalance = calculatedBalance;
    }
    else if (changedField === 'totalBalance') {
      detail.amount = this.round2(base.amount + calculatedBalance - base.totalBalance);
    }
    else {
      detail.amount = this.round2(base.amount + calculatedBalance - base.totalBalance);
    }

    this.recalculateApplicationTotals();
  }

  onApplicationGrossAmountChanged(detail: AccountsPostingApplicationDetail): void {
    if (this.noRecalculate) {
      this.recalculateApplicationTotals();
      return;
    }

    this.recalculateApplicationDetail(detail, 'grossAmount');
  }

  onApplicationAmountChanged(detail: AccountsPostingApplicationDetail): void {
    if (this.noRecalculate) {
      this.recalculateApplicationTotals();
      return;
    }

    this.recalculateApplicationDetail(detail, 'amount');
  }

  onApplicationTotalGrossBalanceChanged(detail: AccountsPostingApplicationDetail): void {
    if (this.noRecalculate) {
      this.recalculateApplicationTotals();
      return;
    }

    this.recalculateApplicationDetail(detail, 'totalGrossBalance');
  }

  onApplicationTotalBalanceChanged(detail: AccountsPostingApplicationDetail): void {
    if (this.noRecalculate) {
      this.recalculateApplicationTotals();
      return;
    }

    this.recalculateApplicationDetail(detail, 'totalBalance');
  }

  onApplicationTotalIOFChanged(detail: AccountsPostingApplicationDetail): void {
    if (this.noRecalculate) {
      this.recalculateApplicationTotals();
      return;
    }

    this.recalculateApplicationDetail(detail, 'totalIOF');
  }

  onApplicationTotalIRChanged(detail: AccountsPostingApplicationDetail): void {
    if (this.noRecalculate) {
      this.recalculateApplicationTotals();
      return;
    }

    this.recalculateApplicationDetail(detail, 'totalIR');
  }

  changeApplicationDays(detail: AccountsPostingApplicationDetail, delta: number): void {
    const previousNetBalance = Number(detail.totalBalance ?? 0);
    detail.iofElapsedDays = Math.max(0, Number(detail.iofElapsedDays ?? 0) + delta);

    const application = this.accountApplications?.find(item => item.id === detail.accountApplicationId);
    if (application) {
      const accumulatedGrossYield = Math.max(
        0,
        this.round2(Number(detail.totalGrossBalance ?? 0) - Number(application.amountApplied || 0))
      );
      const iof = this.round2(
        accumulatedGrossYield * this.yieldService.iofRateFromApplicationTable(Number(detail.iofElapsedDays || 0))
      );
      const irBase = Math.max(0, this.round2(accumulatedGrossYield - iof));
      const account = this.accountPosting.accountsList?.find(
        item => item.id === this.accountPosting.accountId
      );
      const irPercent = Number(account?.irPercent ?? 22.5);
      const ir = account?.isTaxExempt ? 0 : this.round2(irBase * irPercent / 100);
      const newNetBalance = this.round2(Number(detail.totalGrossBalance ?? 0) - iof - ir);

      detail.totalIOF = iof;
      detail.totalIR = ir;
      detail.totalBalance = newNetBalance;
      detail.amount = this.round2(Number(detail.amount ?? 0) + newNetBalance - previousNetBalance);
    }

    this.persistApplicationIofDays(detail);
    this.recalculateApplicationTotals();
  }

  private updateYieldAmountValidator(): void {
    const amountControl = this.accountPostingFormGroup.get('amountFormControl');
    if (!amountControl) return;

    const requiresAmount = !(this.accountPosting.type === 'Y' && this.hasMultipleApplications);

    if (requiresAmount) {
      amountControl.setValidators(Validators.required);
    } else {
      amountControl.clearValidators();
      amountControl.setValue(this.accountPosting.amount ?? 0, { emitEvent: false });
    }

    amountControl.updateValueAndValidity({ emitEvent: false });
  }

  private prepareApplicationDetails(): void {
    if (this.applicationDetailsLoadedFromServer && this.applicationDetails.length > 0) return;

    const saved = this.accountPosting.applicationDetails ?? [];
    if (saved.length > 0) {
      this.applicationDetails = saved.map(detail => ({ ...detail }));
      this.applicationDetailsLoadedFromServer = true;
      this.captureApplicationBaseValues();
      this.recalculateApplicationTotals();
      return;
    }

    const applications = this.getYieldApplications();
    if (applications.length === 0) return;

    this.applicationDetailsLoadedFromServer = false;
    if (this.applicationDetails.length === 0) {
      this.applicationDetails = applications.map(application => ({
        accountApplicationId: application.id!,
        amount: 0,
        grossAmount: 0,
        totalGrossBalance: Number(application.amountApplied || 0),
        totalBalance: Number(application.amountApplied || 0),
        totalIOF: 0,
        totalIR: 0,
        iofElapsedDays: this.getApplicationIofDays(application, new Date(this.accountPosting.date)),
      }));
      this.captureApplicationBaseValues();
    }
  }

  private async getApplicationHistoricalBalanceBefore(
    application: AccountsApplications,
    launchDate: Date
  ): Promise<AccountHistoricalBalance> {
    const applicationAmount = this.round2(Number(application.amountApplied || 0));
    if (!application.id) {
      return { balance: applicationAmount, grossBalance: applicationAmount };
    }

    const normalizedDate = new Date(launchDate);
    normalizedDate.setHours(0, 0, 0, 0);

    const dateKey = [
      normalizedDate.getFullYear(),
      String(normalizedDate.getMonth() + 1).padStart(2, '0'),
      String(normalizedDate.getDate()).padStart(2, '0')
    ].join('-');
    const excludePostingId = this.accountPosting.editing ? this.accountPosting.id : undefined;
    const cacheKey = `${application.id}|${dateKey}|${excludePostingId ?? 0}`;

    let request = this.applicationHistoricalBalanceCache.get(cacheKey);
    if (!request) {
      request = firstValueFrom(
        this.accountPostingsService.getHistoricalApplicationBalance(
          application.id,
          normalizedDate,
          excludePostingId
        )
      ).catch(() => this.getLocalApplicationHistoricalBalance(application, normalizedDate));

      this.applicationHistoricalBalanceCache.set(cacheKey, request);
    }

    return await request;
  }

  private getLocalApplicationHistoricalBalance(
    application: AccountsApplications,
    launchDate: Date
  ): AccountHistoricalBalance {
    const applicationAmount = this.round2(Number(application.amountApplied || 0));
    const yields = (this.accountPosting.accountPostingsYields ?? [])
      .filter(yieldPosting => {
        if (yieldPosting.id && this.accountPosting.id && yieldPosting.id === this.accountPosting.id) return false;

        const yieldDate = new Date(yieldPosting.date);
        yieldDate.setHours(0, 0, 0, 0);
        if (yieldDate < launchDate) return true;
        if (yieldDate > launchDate) return false;

        if (!this.accountPosting.editing || !this.accountPosting.id) return true;

        const currentPosition = Number(this.accountPosting.position ?? Number.MAX_SAFE_INTEGER);
        const yieldPosition = Number(yieldPosting.position ?? Number.MAX_SAFE_INTEGER);

        return yieldPosition < currentPosition ||
          (yieldPosition === currentPosition &&
           Number(yieldPosting.id ?? 0) < Number(this.accountPosting.id));
      })
      .sort((a, b) => {
        const dateDifference = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDifference) return dateDifference;

        const positionDifference = Number(a.position ?? 0) - Number(b.position ?? 0);
        return positionDifference || Number(a.id ?? 0) - Number(b.id ?? 0);
      });

    for (let index = yields.length - 1; index >= 0; index--) {
      const yieldPosting = yields[index];
      const detail = yieldPosting.applicationDetails?.find(
        item => item.accountApplicationId === application.id
      );

      if (!detail) continue;

      return {
        balance: this.round2(Number(
          detail.totalBalance
          ?? (Number(detail.totalGrossBalance ?? applicationAmount)
            - Number(detail.totalIOF ?? 0)
            - Number(detail.totalIR ?? 0))
        )),
        grossBalance: this.round2(Number(detail.totalGrossBalance ?? applicationAmount)),
        totalIOF: detail.totalIOF,
        totalIR: detail.totalIR,
        iofElapsedDays: detail.iofElapsedDays,
        postingDate: yieldPosting.date
      };
    }

    return { balance: applicationAmount, grossBalance: applicationAmount };
  }

  private async getApplicationGrossBalanceBefore(
    application: AccountsApplications,
    launchDate: Date
  ): Promise<number> {
    const historical = await this.getApplicationHistoricalBalanceBefore(application, launchDate);
    return this.round2(Number(historical.grossBalance ?? application.amountApplied ?? 0));
  }

  private async getApplicationNetBalanceBefore(
    application: AccountsApplications,
    launchDate: Date
  ): Promise<number> {
    const historical = await this.getApplicationHistoricalBalanceBefore(application, launchDate);
    return this.round2(Number(historical.balance ?? application.amountApplied ?? 0));
  }

  private async getApplicationIofDaysBefore(
    application: AccountsApplications,
    launchDate: Date
  ): Promise<number> {
    const historical = await this.getApplicationHistoricalBalanceBefore(application, launchDate);

    if (historical.iofElapsedDays === undefined || historical.iofElapsedDays === null) {
      return this.getApplicationIofDays(application, launchDate);
    }

    const previousDays = this.toNonNegativeInt(historical.iofElapsedDays);
    if (!historical.postingDate) return previousDays;

    const postingDate = new Date(historical.postingDate);
    const normalizedLaunchDate = new Date(launchDate);
    postingDate.setHours(0, 0, 0, 0);
    normalizedLaunchDate.setHours(0, 0, 0, 0);

    const elapsedDays = Math.max(
      0,
      Math.floor((normalizedLaunchDate.getTime() - postingDate.getTime()) / 86400000)
    );

    return previousDays + elapsedDays;
  }

  private async calculateApplicationDetails(account: Accounts): Promise<void> {
    const applications = this.getYieldApplications();
    if (applications.length <= 1 || this.applicationDetailsLoadedFromServer) return;

    const launchDate = new Date(this.accountPosting.date);
    launchDate.setHours(0, 0, 0, 0);

    const applicationInputs = await Promise.all(
      applications.map(async application => ({
        application,
        grossBalanceBefore: await this.getApplicationGrossBalanceBefore(application, launchDate),
        netBalanceBefore: await this.getApplicationNetBalanceBefore(application, launchDate),
        iofElapsedDays: await this.getApplicationIofDaysBefore(application, launchDate),
      }))
    );

    const calculation = await this.yieldService.suggestYieldMultipleApplications(
      account,
      applicationInputs
    );

    this.applicationDetails = calculation.applicationDetails;
    this.recalculateApplicationTotals();
    this.captureApplicationBaseValues();

  }


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

  private getIofDaysKey(accountId?: number): string {
    return `${this.IOF_DAYS_STORAGE_KEY}.${accountId ?? 0}`;
  }

  private getIofDateKey(accountId?: number): string {
    return `${this.IOF_DATE_STORAGE_KEY}.${accountId ?? 0}`;
  }

  private getLegacyIofDaysKey(): string {
    return this.IOF_DAYS_STORAGE_KEY;
  }

  private getLegacyIofDateKey(): string {
    return this.IOF_DATE_STORAGE_KEY;
  }

  private getApplicationIofDaysKey(accountId?: number, applicationId?: number): string {
    return `${this.IOF_DAYS_STORAGE_KEY}.${accountId ?? 0}.${applicationId ?? 0}`;
  }

  private getApplicationIofDateKey(accountId?: number, applicationId?: number): string {
    return `${this.IOF_DATE_STORAGE_KEY}.${accountId ?? 0}.${applicationId ?? 0}`;
  }

  private getAlgorithmKey(accountId?: number): string {
    return `${this.ALGORITHM_STORAGE_KEY}.${accountId ?? 0}`;
  }

  private getStoredIofValue(daysKey: string, dateKey: string, fallbackDays: number): number {
    const storedValue = localStorage.getItem(daysKey);
    if (storedValue === null) return fallbackDays;

    const storedDays = this.toNonNegativeInt(Number(storedValue));
    const storedDateText = localStorage.getItem(dateKey);
    if (!storedDateText) return storedDays;

    const storedDate = new Date(storedDateText);
    const today = new Date();
    storedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const elapsedDays = Math.max(
      0,
      Math.floor((today.getTime() - storedDate.getTime()) / 86400000)
    );

    return storedDays + elapsedDays;
  }

  private getApplicationIofDays(application: AccountsApplications, referenceDate: Date): number {
    const appliedDate = new Date(application.dateApplied);
    const normalizedReferenceDate = new Date(referenceDate);
    appliedDate.setHours(0, 0, 0, 0);
    normalizedReferenceDate.setHours(0, 0, 0, 0);

    const calculatedDays = Math.max(
      0,
      Math.floor((normalizedReferenceDate.getTime() - appliedDate.getTime()) / 86400000)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (normalizedReferenceDate < today) return calculatedDays;

    const storedApplicationDays = this.getStoredIofValue(
      this.getApplicationIofDaysKey(this.accountPosting.accountId, application.id),
      this.getApplicationIofDateKey(this.accountPosting.accountId, application.id),
      calculatedDays
    );

    return Math.max(calculatedDays, storedApplicationDays);
  }

  private persistApplicationIofDays(detail: AccountsPostingApplicationDetail): void {
    if (
      this.accountPosting.editing
      || this.isRetroactiveDate()
      || !this.accountPosting.accountId
      || !detail.accountApplicationId
    ) {
      return;
    }

    localStorage.setItem(
      this.getApplicationIofDaysKey(this.accountPosting.accountId, detail.accountApplicationId),
      String(this.toNonNegativeInt(detail.iofElapsedDays))
    );
    localStorage.setItem(
      this.getApplicationIofDateKey(this.accountPosting.accountId, detail.accountApplicationId),
      new Date().toISOString()
    );
  }

  transferAccountsList: any[] = [];

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<AccountPostingsDialog>,
    @Inject(MAT_DIALOG_DATA) public accountPosting: AccountsPostings,
    private cd: ChangeDetectorRef,
    private yieldService: YieldService,
    private accountApplicationsService: AccountApplicationsService,
    private accountPostingsService: AccountPostingsService,
    private accountService: AccountService,
    private messenger: Messenger,

  ) { }

  ngOnInit(): void {
    this.initialCurrentBalanceForYield = Number(
      this.accountPosting.currentBalanceForYield ?? this.accountPosting.totalBalance ?? 0
    );
    this.initialCurrentGrossBalanceForYield = Number(
      this.accountPosting.currentGrossBalanceForYield
      ?? this.accountPosting.totalGrossBalance
      ?? this.initialCurrentBalanceForYield
    );

    this.algorithmTypes = this.algorithmTypes
      .sort((a, b) => a.viewValue.localeCompare(b.viewValue));

    this.accountPosting.accountsList = [...(this.accountPosting.accountsList || [])]
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));

    this.accountService.readAvailable(this.accountPosting.reference).subscribe({
      next: (accounts) => {
        this.accountPosting.accountsList = [...accounts]
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));

        this.refreshTransferAccountsList();
        if (this.accountPosting.accountId) {
          this.accountApplicationsService.readByAccount(this.accountPosting.accountId).subscribe(apps => {
            this.accountApplications = apps.filter(x => !x.disabled);
            if (this.accountPosting.type === 'Y') this.prepareApplicationDetails();
          });
        }
      },
    });

    const control = this.accountPostingFormGroup.get('iofElapsedDaysFormControl');

    if (!control) return;

    this.iofDaysSub = control.valueChanges.subscribe(value => {
      const days = this.toNonNegativeInt(value);

      if (days !== value) {
        control.setValue(days, { emitEvent: false });
      }

      this.accountPosting.iofElapsedDays = days;

      if (
        !this.accountPosting.editing
        && !this.isRetroactiveDate()
        && (!this.accountApplications || this.getYieldApplications().length <= 1)
      ) {
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

    // 1) localStorage legado: conta e, se necessário, a chave global antiga.
    const accountDaysKey = this.getIofDaysKey(account?.id);
    const accountDateKey = this.getIofDateKey(account?.id);
    const stored = localStorage.getItem(accountDaysKey);
    const legacyStored = stored === null
      ? localStorage.getItem(this.getLegacyIofDaysKey())
      : stored;
    const storedDaysKey = stored === null
      ? this.getLegacyIofDaysKey()
      : accountDaysKey;
    const storedDateKey = stored === null
      ? this.getLegacyIofDateKey()
      : accountDateKey;

    if (legacyStored !== null) {
      finish(this.getStoredIofValue(storedDaysKey, storedDateKey, 0));
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
          this.prepareApplicationDetails();

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

  async currentDateChanged(date: Date): Promise<void> {
    date.setHours(0, 0, 0, 0);
    this.accountPosting.date.setHours(0, 0, 0, 0);

    let diff = Math.floor((new Date(date).getTime() - new Date(this.accountPosting.date).getTime()) / 86400000);

    this.changeDays(diff, false, false);

    this.accountPosting.date = date;

    const requestId = ++this.dateChangeRequestId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let balanceForYield = this.initialCurrentBalanceForYield;
    let grossBalanceForYield = this.initialCurrentGrossBalanceForYield;
    let isHistoricalBalance = false;

    if (date < today) {
      const historicalBalance = await firstValueFrom(
        this.accountPostingsService.getHistoricalBalance(
          this.accountPosting.accountId,
          date,
          this.accountPosting.editing ? this.accountPosting.id : undefined
        )
      );

      if (requestId !== this.dateChangeRequestId) return;

      balanceForYield = historicalBalance.balance;
      grossBalanceForYield = historicalBalance.grossBalance;
      isHistoricalBalance = true;
    }

    this.isHistoricalBalanceForYield = isHistoricalBalance;
    this.accountPosting.currentBalanceForYield = this.round2(balanceForYield);
    this.accountPosting.currentGrossBalanceForYield = this.round2(grossBalanceForYield);

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

    this.prepareApplicationDetails();
    if (this.hasMultipleApplications) {
      this.recalculateApplicationTotals();
      this.accountPosting.applicationDetails = this.applicationDetails.map(x => ({ ...x }));
    } else {
      const application = this.getYieldApplications()[0];
      const detail = application
        ? this.applicationDetails.find(item => item.accountApplicationId === application.id)
        : (this.applicationDetails.length === 1 ? this.applicationDetails[0] : undefined);

      if (detail) {
        detail.amount = this.round2(Number(this.accountPosting.amount ?? 0));
        detail.grossAmount = this.round2(Number(this.accountPosting.grossAmount ?? 0));
        detail.totalGrossBalance = this.round2(Number(this.accountPosting.totalGrossBalance ?? this.saldoBruto));
        detail.totalBalance = this.round2(Number(this.saldoLiquido));
        detail.totalIOF = this.round2(Number(this.accountPosting.totalIOF ?? 0));
        detail.totalIR = this.round2(Number(this.accountPosting.totalIR ?? 0));
        detail.iofElapsedDays = this.toNonNegativeInt(this.accountPosting.iofElapsedDays);
      }

      this.accountPosting.applicationDetails = this.applicationDetails.map(x => ({ ...x }));
      this.accountPosting.totalGrossBalance = this.saldoBruto;
      this.accountPosting.totalBalance = this.saldoLiquido;
    }

    this.dialogRef.close(this.accountPosting);
  }

  delete(): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      panelClass: localStorage.getItem('budgetLayout') === 'modern'
        ? 'modern-confirm-dialog-panel'
        : undefined,
      data: <ConfirmDialogData>{
        title: 'Excluir Lançamento',
        message: `Confirma a EXCLUSÃO do lançamento "${this.accountPosting.description}"?`,
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

  changeDays(delta: number, recalculate: boolean = true, persist: boolean = true): void {
    const control = this.accountPostingFormGroup.get('iofElapsedDaysFormControl');
    const value = Number(control?.value || 0);
    const days = Math.max(0, value + delta);

    control?.setValue(days, { emitEvent: persist });
    this.accountPosting.iofElapsedDays = days;

    if (recalculate) {
      this.onTypeChange();
    }
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

        const selectedAccount = this.accountPosting.accountsList?.find((a) => a.id === this.accountPosting.accountId);
        const account = selectedAccount ? { ...selectedAccount } : undefined;

        if (account?.id && !this.accountApplications) {
          try {
            this.accountApplications = await firstValueFrom(this.accountApplicationsService.readByAccount(account.id));
          } catch {
            this.accountApplications = [];
          }
        }

        // Em edição retroativa, obtém a base anterior ao próprio rendimento.
        // Assim, um TotalGrossBalance salvo incorretamente não é reutilizado.
        let historicalBalanceForEditing: { balance: number; grossBalance: number } | undefined;
        if (firstLoad && account?.id && this.isRetroactiveDate()) {
          historicalBalanceForEditing = await firstValueFrom(
            this.accountPostingsService.getHistoricalBalance(
              account.id,
              new Date(this.accountPosting.date),
              this.accountPosting.id
            )
          );
        }

        const hasHistoricalBase = historicalBalanceForEditing !== undefined;
        const referenceBalance = Number(this.accountPosting.totalBalance ?? 0);
        const referenceGrossBalance = Number(this.accountPosting.totalGrossBalance ?? referenceBalance);
        const shouldRemoveOriginalYield = this.accountPosting.editing && !this.isHistoricalBalanceForYield && !hasHistoricalBase;
        const originalAmount = shouldRemoveOriginalYield
          ? Number(this.accountPosting.originalAmount ?? 0)
          : 0;
        const originalGrossAmount = shouldRemoveOriginalYield
          ? Number(this.accountPosting.originalGrossAmount ?? this.accountPosting.originalAmount ?? 0)
          : 0;
        let currentBalanceForYield = this.round2(
          historicalBalanceForEditing?.balance ?? Number(this.accountPosting.currentBalanceForYield ?? referenceBalance) - originalAmount
        );
        let currentGrossBalanceForYield = this.round2(
          historicalBalanceForEditing?.grossBalance ?? Number(this.accountPosting.currentGrossBalanceForYield ?? referenceGrossBalance) - originalGrossAmount
        );

        const applicationsForYield = this.getYieldApplications();
        if (applicationsForYield.length > 0) {
          const launchDateForApplications = new Date(this.accountPosting.date);
          launchDateForApplications.setHours(0, 0, 0, 0);

          const applicationBalances = await Promise.all(
            applicationsForYield.map(async application => ({
              grossBalance: await this.getApplicationGrossBalanceBefore(application, launchDateForApplications),
              netBalance: await this.getApplicationNetBalanceBefore(application, launchDateForApplications),
              iofElapsedDays: await this.getApplicationIofDaysBefore(application, launchDateForApplications),
            }))
          );

          currentGrossBalanceForYield = this.round2(
            applicationBalances.reduce((sum, item) => sum + item.grossBalance, 0)
          );
          currentBalanceForYield = this.round2(
            applicationBalances.reduce((sum, item) => sum + item.netBalance, 0)
          );

          if (applicationBalances.length === 1) {
            const iofElapsedDays = applicationBalances[0].iofElapsedDays;
            this.accountPosting.iofElapsedDays = iofElapsedDays;
            this.accountPostingFormGroup.get('iofElapsedDaysFormControl')
              ?.setValue(iofElapsedDays, { emitEvent: false });
          }
        }

        account!.totalBalance = currentBalanceForYield;
        account!.totalBalanceGross = currentGrossBalanceForYield;

        this.saldoBruto = this.round2(currentGrossBalanceForYield + Number(this.accountPosting.grossAmount ?? 0));
        this.saldoLiquido = this.round2(currentBalanceForYield + Number(this.accountPosting.amount ?? 0));

        if (firstLoad && this.accountPosting.editing) {
          this.saldoBruto = this.round2(referenceGrossBalance);
          this.saldoLiquido = this.round2(referenceBalance);
          this.accountPosting.totalGrossBalance = this.saldoBruto;
          this.accountPosting.totalBalance = this.saldoLiquido;

          this.prepareApplicationDetails();

          if (!this.noRecalculate && this.getYieldApplications().length > 1 && !this.applicationDetailsLoadedFromServer) {
            await this.calculateApplicationDetails(account!);
          }

          this.captureYieldBaseValues();
          return;
        }

        this.prepareApplicationDetails();
        this.isApplyingSuggestedYield = true;

        try {
          if (this.hasMultipleApplications) {
            // Múltiplas aplicações usam exclusivamente o cálculo individual.
            this.accountPosting.grossAmount = 0;
            this.accountPosting.amount = 0;
            this.accountPosting.totalIOF = 0;
            this.accountPosting.totalIR = 0;

            await this.calculateApplicationDetails(account!);
            this.recalculateApplicationTotals();
          } else {
            let suggestYield = {
              grossYield: 0,
              netYield: 0,
              totalGross: 0,
              totalNet: 0,
              iofTotal: 0,
              irTotal: 0,
              totalAplicado: 0
            };

            if (this.accountPosting.algorithmType === '1') {
              suggestYield = await this.yieldService.suggestYield1(
                account!,
                this.accountPosting.date,
                this.accountPosting.iofElapsedDays
              );
            }
            else if (this.accountPosting.algorithmType === '2') {
              suggestYield = await this.yieldService.suggestYield2(account!);
            }
            else if (this.accountPosting.algorithmType === '3') {
              suggestYield = await this.yieldService.suggestYield3(
                account!,
                this.accountPosting.date,
                this.accountPosting.iofElapsedDays!,
                this.accountPosting.totalPreviousYield!,
                this.previousBusinessDayHoliday
              );
            }
            else if (this.accountPosting.algorithmType === '4' || this.accountPosting.algorithmType === '5') {
              suggestYield = await this.yieldService.suggestYield4(
                account!,
                this.accountPosting.date,
                this.accountPosting.iofElapsedDays!,
                this.accountPosting.totalPreviousYield!
              );
            }

            this.accountPosting.grossAmount = suggestYield.grossYield;
            this.accountPosting.amount = suggestYield.netYield;
            this.accountPosting.totalIOF = suggestYield.iofTotal;
            this.accountPosting.totalIR = suggestYield.irTotal;
            this.accountPosting.totalGrossBalance = this.round2(
              currentGrossBalanceForYield + suggestYield.grossYield
            );
            this.accountPosting.totalBalance = this.round2(
              currentBalanceForYield + suggestYield.netYield
            );

            this.saldoBruto = this.accountPosting.totalGrossBalance;
            this.saldoLiquido = this.accountPosting.totalBalance;
            this.captureYieldBaseValues();
          }

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
      this.updateYieldAmountValidator();
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

    this.transferAccountsList = (origin
      ? source.filter(a => a.id !== origin)
      : source.slice())
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' }));

    if (this.accountPosting.toAccountId && this.accountPosting.toAccountId === origin) {
      this.accountPosting.toAccountId = undefined;

      const ctrl = this.accountPostingFormGroup.get('toAccountIdFormControl');
      if (ctrl) ctrl.setValue(undefined, { emitEvent: false });
    }
  }

  isTransferMode(): boolean {
    return this.accountPosting.type === 'T';
  }

  useFullAccountBalance(): void {
    if (!this.isTransferMode()) return;

    const amount = this.round2(Number(this.accountPosting.totalBalance || 0));
    const grossAmount = this.round2(Number(this.accountPosting.totalGrossBalance ?? amount));

    this.accountPosting.amount = amount;
    this.accountPosting.grossAmount = grossAmount;
    this.setControlValue('amountFormControl', amount);
    this.setControlValue('grossAmountFormControl', grossAmount);
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

  private isRetroactiveDate(): boolean {
    const postingDate = new Date(this.accountPosting.date);
    const today = new Date();

    postingDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return postingDate < today;
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
    if (this.isTransferMode()) {
      const amount = this.round2(Number(this.accountPosting.amount || 0));
      this.accountPosting.grossAmount = amount;
      this.setControlValue('grossAmountFormControl', amount);
      return;
    }

    this.calculaSaldoLiquido(true);
  }

  onSaldoLiquidoChanged($event: any) {
    this.accountPosting.totalBalance = this.round2(Number(this.saldoLiquido ?? 0));
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
