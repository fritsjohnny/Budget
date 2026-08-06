/// <reference types="jasmine" />

import { HttpClient } from '@angular/common/http';
import { AccountApplicationsService } from 'src/app/services/accountapplications/accountapplications.service';
import { AccountYieldRangeService } from 'src/app/services/accountyieldrange/accountyieldrange.service';
import { Accounts } from 'src/app/models/accounts.model';
import { AccountsApplications } from 'src/app/models/accountsapplications.model';
import { Messenger } from 'src/app/common/messenger';
import { YieldService } from './yield.service';

describe('YieldService - múltiplas aplicações', () => {
  let service: YieldService;

  const account: Accounts = {
    id: 1,
    userId: 1,
    name: 'PicPay',
    yieldPercent: 110,
    irPercent: 22.5,
    isTaxExempt: false
  };

  function createApplication(
    id: number,
    amountApplied: number,
    cdiPercent: number | null = 110
  ): AccountsApplications {
    return {
      id,
      accountId: account.id!,
      dateApplied: new Date('2026-08-04T00:00:00'),
      amountApplied,
      maximumAmount: null,
      disabled: false,
      cdiPercent,
      fixedRate: null,
      maturityDate: null,
      createdAt: null
    };
  }

  function createService(): YieldService {
    const messenger = { errorHandler: () => undefined } as unknown as Messenger;

    return new YieldService(
      {} as HttpClient,
      messenger,
      {} as AccountApplicationsService,
      {} as AccountYieldRangeService
    );
  }

  beforeEach(() => {
    service = createService();

    spyOn<any>(service, 'getCdiDiarioPercent')
      .and.resolveTo(0.052443);
  });

  it('calcula a aplicação recente com os valores esperados pelo banco', async () => {
    const application = createApplication(2, 16000);

    const result = await service.suggestYieldMultipleApplications(account, [
      {
        application,
        grossBalanceBefore: 16000,
        netBalanceBefore: 16000,
        iofElapsedDays: 1
      }
    ]);

    const detail = result.applicationDetails[0];

    expect(detail.grossAmount).toBe(9.23);
    expect(detail.totalGrossBalance).toBe(16009.23);
    expect(detail.totalIOF).toBe(8.86);
    expect(detail.totalIR).toBe(0.08);
    expect(detail.amount).toBe(0.29);
    expect(detail.totalBalance).toBe(16000.29);

    expect(result.grossYield).toBe(9.23);
    expect(result.iofTotal).toBe(8.86);
    expect(result.irTotal).toBe(0.08);
    expect(result.netYield).toBe(0.29);
  });

  it('mantém o cálculo da aplicação recente independente da aplicação antiga', async () => {
    const oldApplication = createApplication(1, 30000);
    const recentApplication = createApplication(2, 16000);

    const onlyRecent = await service.suggestYieldMultipleApplications(account, [
      {
        application: recentApplication,
        grossBalanceBefore: 16000,
        netBalanceBefore: 16000,
        iofElapsedDays: 1
      }
    ]);

    const withOldApplication = await service.suggestYieldMultipleApplications(account, [
      {
        application: oldApplication,
        grossBalanceBefore: 30000,
        netBalanceBefore: 30000,
        iofElapsedDays: 86
      },
      {
        application: recentApplication,
        grossBalanceBefore: 16000,
        netBalanceBefore: 16000,
        iofElapsedDays: 1
      }
    ]);

    const recentDetail = withOldApplication.applicationDetails
      .find(detail => detail.accountApplicationId === recentApplication.id);

    expect(recentDetail).toBeDefined();
    expect(recentDetail?.grossAmount).toBe(onlyRecent.applicationDetails[0].grossAmount);
    expect(recentDetail?.totalGrossBalance).toBe(16009.23);
    expect(recentDetail?.totalIOF).toBe(8.86);
    expect(recentDetail?.totalIR).toBe(0.08);
    expect(recentDetail?.totalBalance).toBe(16000.29);
  });

  it('consolida os detalhes sem recalcular os impostos sobre o total da conta', async () => {
    const result = await service.suggestYieldMultipleApplications(account, [
      {
        application: createApplication(1, 30000),
        grossBalanceBefore: 30000,
        netBalanceBefore: 30000,
        iofElapsedDays: 86
      },
      {
        application: createApplication(2, 16000),
        grossBalanceBefore: 16000,
        netBalanceBefore: 16000,
        iofElapsedDays: 1
      }
    ]);

    const details = result.applicationDetails;

    expect(result.grossYield).toBe(
      details.reduce((total, detail) => total + Number(detail.grossAmount), 0)
    );
    expect(result.iofTotal).toBe(
      details.reduce((total, detail) => total + Number(detail.totalIOF), 0)
    );
    expect(result.irTotal).toBe(
      details.reduce((total, detail) => total + Number(detail.totalIR), 0)
    );
    expect(result.totalGross).toBe(
      details.reduce((total, detail) => total + Number(detail.totalGrossBalance), 0)
    );
    expect(result.totalNet).toBe(
      details.reduce((total, detail) => total + Number(detail.totalBalance), 0)
    );
  });

  it('usa a tabela correta de IOF por aplicação', () => {
    expect(service.iofRateFromApplicationTable(0)).toBe(0);
    expect(service.iofRateFromApplicationTable(1)).toBe(0.96);
    expect(service.iofRateFromApplicationTable(2)).toBe(0.93);
    expect(service.iofRateFromApplicationTable(29)).toBe(0.03);
    expect(service.iofRateFromApplicationTable(30)).toBe(0);
  });
});
