/// <reference types="jasmine" />

import { ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { Messenger } from 'src/app/common/messenger';
import { AccountPostingsComponent } from '../accountpostings.component';
import { AccountsPostings } from 'src/app/models/accountspostings.model';
import { AccountPostingsDialog } from './accountpostings-dialog';
import { AccountApplicationsService } from 'src/app/services/accountapplications/accountapplications.service';
import { AccountPostingsService } from 'src/app/services/accountpostings/accountpostings.service';
import { AccountService } from 'src/app/services/account/account.service';
import { YieldService } from 'src/app/services/yield/yield.service';

describe('AccountPostings saldo líquido na edição', () => {
  function createPosting(overrides: Partial<AccountsPostings> = {}): AccountsPostings {
    return {
      id: 12,
      accountId: 1,
      date: new Date('2026-08-18T00:00:00'),
      reference: '202608',
      position: 12,
      description: 'Rendimento',
      amount: 0.98,
      remaining: 0,
      runningAmount: 2032.44,
      note: null,
      type: 'Y',
      totalBalance: 0,
      totalGrossBalance: 2041.84,
      grossAmount: 1.26,
      totalYields: 12.41,
      lastYield: 0.98,
      originalAmount: 0.98,
      originalGrossAmount: 1.26,
      ...overrides,
    };
  }

  it('envia para a edição o mesmo saldo líquido mostrado na lista', () => {
    let dialogData: AccountsPostings | undefined;

    const component = Object.create(AccountPostingsComponent.prototype) as any;
    component.modernLayout = true;
    component.accountId = 1;
    component.cdr = { markForCheck: () => undefined };
    component.reference = '202608';
    component.accountsList = [];
    component.incomes = [];
    component.expenses = [];
    component.accountpostings = [];
    component.totalForYieldsDialog = 0;
    component.totalPreviousYield = 0;
    component.lastYield = 0;
    component.totalBalance = 0;
    component.currentBalance = 0;
    component.currentGrossBalance = 0;
    component.totalGrossBalance = 0;
    component.accountUpdated = { emit: () => undefined };
    component.dialog = {
      open: (_dialogComponent: unknown, config: { data: AccountsPostings }) => {
        dialogData = config.data;
        return { afterClosed: () => of(null) };
      },
    } as unknown as MatDialog;

    component.editOrDelete(createPosting(), null);

    expect(dialogData?.totalBalance).toBe(2032.44);
  });

  it('mantém o saldo calculado no FormControl durante a inclusão', () => {
    const posting = createPosting({ editing: false, totalBalance: 0 });
    const component = new AccountPostingsDialog(
      {} as MatDialog,
      {} as MatDialogRef<AccountPostingsDialog>,
      posting,
      {} as ChangeDetectorRef,
      {} as YieldService,
      { readByAccount: () => of([]) } as unknown as AccountApplicationsService,
      {} as AccountPostingsService,
      {} as AccountService,
      {} as Messenger
    );

    component.applicationDetails = [{
      accountApplicationId: 1,
      amount: 0.98,
      grossAmount: 1.26,
      totalGrossBalance: 2041.84,
      totalBalance: 2032.44,
      totalIOF: 0,
      totalIR: 9.40,
      iofElapsedDays: 0,
    }];

    component.recalculateApplicationTotals();

    expect(component.saldoLiquido).toBe(2032.44);
    expect(component.accountPostingFormGroup.get('totalBalanceFormControl')?.value).toBe(2032.44);
  });

  it('calcula o saldo líquido no FormControl durante a inclusão', async () => {
    const posting = createPosting({
      editing: false,
      date: new Date(),
      amount: 0,
      grossAmount: 0,
      totalBalance: 0,
      totalGrossBalance: 0,
      algorithmType: '1',
      currentBalanceForYield: 2031.46,
      currentGrossBalanceForYield: 2040.58,
      accountsList: [{ id: 1, name: 'Conta' }] as any,
    });

    const component = new AccountPostingsDialog(
      {} as MatDialog,
      {} as MatDialogRef<AccountPostingsDialog>,
      posting,
      { detectChanges: () => undefined } as unknown as ChangeDetectorRef,
      {
        suggestYield1: async () => ({
          grossYield: 1.26,
          netYield: 0.98,
          totalGross: 1.26,
          totalNet: 0.98,
          iofTotal: 0,
          irTotal: 0,
          totalAplicado: 0,
        }),
      } as unknown as YieldService,
      { readByAccount: () => of([]) } as unknown as AccountApplicationsService,
      {} as AccountPostingsService,
      {} as AccountService,
      {} as Messenger
    );

    await component.onTypeChange(true);

    expect(component.saldoLiquido).toBe(2032.44);
    expect(component.accountPostingFormGroup.get('totalBalanceFormControl')?.value).toBe(2032.44);
  });

  it('lê o saldo persistido na edição e só recalcula após interação', async () => {
    const posting = createPosting({ editing: true, totalBalance: 2032.44 });

    const component = new AccountPostingsDialog(
      {} as MatDialog,
      {} as MatDialogRef<AccountPostingsDialog>,
      posting,
      {} as ChangeDetectorRef,
      {} as YieldService,
      { readByAccount: () => of([]) } as unknown as AccountApplicationsService,
      {} as AccountPostingsService,
      {} as AccountService,
      {} as Messenger
    );

    await component.onTypeChange(true);

    expect(component.saldoLiquido).toBe(2032.44);
    expect(component.accountPostingFormGroup.get('totalBalanceFormControl')?.value).toBe(2032.44);

    component.onInitialEditInteraction();
    component.accountPosting.amount = 1;
    component.onValorChanged(1);

    expect(component.accountPostingFormGroup.get('totalBalanceFormControl')?.value).toBe(2032.46);
  });
});
