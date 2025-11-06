import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Messenger } from 'src/app/common/messenger';
import { Accounts } from 'src/app/models/accounts.model';
import { AccountApplicationsService } from '../accountapplications/accountapplications.service';
import { AccountsApplications } from 'src/app/models/accountsapplications.model';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class YieldService {
  private cdiCache: number | null = null;

  constructor(
    private http: HttpClient,
    private messenger: Messenger,
    private accountApplicationsService: AccountApplicationsService) { }

  async getCdiDiarioPercent(): Promise<number> {
    if (this.cdiCache) return Promise.resolve(this.cdiCache);

    // URL oficial da série SGS 12: CDI diário (percentual ao dia)
    const url = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json';

    return this.http.get<any[]>(url).toPromise()
      .then(data => {
        const valorStr = data?.[0]?.valor;
        const valor = parseFloat((valorStr + '').replace(',', '.'));

        if (isNaN(valor)) throw new Error('Valor CDI inválido');

        this.cdiCache = valor; // cache local para evitar múltiplas requisições
        return valor;
      })
      .catch(() => 13.65); // fallback: valor aproximado para CDI diário (%)
  }

  async suggestYieldOld(account: Accounts): Promise<{ grossAmount: number; netAmount: number }> {
    if (!account || !account.yieldPercent)
      return { grossAmount: 0, netAmount: 0 };

    const saldoBruto = Number(account.totalBalanceGross ?? account.totalBalance);
    const yieldPercent = Number(account.yieldPercent);    // Ex: 108 (%)
    const irPercent = Number(account.irPercent ?? 22.5);  // Ex: 17.5, 20, 22.5
    const isTaxExempt = account.isTaxExempt ?? false;

    let cdiDiarioPercent = 0;
    try {
      // Obtém CDI diário percentual (ex: 0.0551014%)
      cdiDiarioPercent = await this.getCdiDiarioPercent();
    } catch (error) {
      this.messenger.errorHandler('Erro ao obter CDI diário. Usando valor do último rendimento.');
      // Caso erro na obtenção do CDI, utiliza o último rendimento
      return { grossAmount: account.lastYield ?? 0, netAmount: account.lastYield ?? 0 };
    }

    const cdiDiario = cdiDiarioPercent / 100;

    // Calcula taxa efetiva aplicada
    const taxaAplicada = cdiDiario * (yieldPercent / 100);

    const rendimentoBruto = saldoBruto * taxaAplicada;
    const rendimentoLiquido = isTaxExempt
      ? rendimentoBruto
      : rendimentoBruto * (1 - irPercent / 100);

    let suggestYield = {
      grossAmount: Math.trunc(rendimentoBruto * 100) / 100,
      netAmount: Math.trunc(rendimentoLiquido * 100) / 100
    };

    return suggestYield;
  }

  // IOF por dia corrido (1..29). 30+ => 0
  IOF_TABLE: number[] = [
    0,     // 0 (não usado)
    0.96,  // 1
    0.93,  // 2
    0.90,  // 3
    0.86,  // 4
    0.83,  // 5
    0.80,  // 6
    0.76,  // 7
    0.73,  // 8
    0.70,  // 9
    0.66,  // 10
    0.63,  // 11
    0.60,  // 12
    0.56,  // 13
    0.53,  // 14
    0.50,  // 15
    0.46,  // 16
    0.43,  // 17
    0.40,  // 18
    0.36,  // 19
    0.33,  // 20
    0.30,  // 21
    0.26,  // 22
    0.23,  // 23
    0.20,  // 24
    0.16,  // 25
    0.13,  // 26
    0.10,  // 27
    0.06,  // 28
    0.03   // 29
  ];

  iofRateFromTable(daysCorridos: number): number {
    if (daysCorridos <= 0) return 0;
    if (daysCorridos >= 30) return 0;
    return this.IOF_TABLE[daysCorridos] ?? 0;
  }

  async suggestYield(account: Accounts): Promise<{
    totalGross: number;
    totalNet: number;
    grossYield: number;
    netYield: number;
  }> {
    if (!account || !account.yieldPercent)
      return { totalGross: 0, totalNet: 0, grossYield: 0, netYield: 0 };

    const yieldPercent = Number(account.yieldPercent);    // ex.: 107, 108
    const irPercent = Number(account.irPercent ?? 22.5);
    const isTaxExempt = account.isTaxExempt ?? false;

    // CDI do dia (percentual, ex.: 0.0551014%)
    let cdiDiarioPercent = 0;
    try {
      cdiDiarioPercent = await this.getCdiDiarioPercent();
    } catch {
      this.messenger.errorHandler('Erro ao obter CDI diário. Usando último rendimento.');
      return {
        totalGross: account.totalBalanceGross ?? 0,
        totalNet: account.totalBalance ?? 0,
        grossYield: account.lastYield ?? 0,
        netYield: account.lastYield ?? 0,
      };
    }

    const cdiDiario = cdiDiarioPercent / 100;
    const taxaAplicada = cdiDiario * (yieldPercent / 100);

    // Saldo bruto atual da conta (base do dia)
    const saldoBruto = Number(account.totalBalanceGross ?? account.totalBalance);
    const grossYield = saldoBruto * taxaAplicada; // rendimento bruto do dia (única coisa que de fato estamos calculando)

    // Lê aportes só para saber o quanto ainda está no período de IOF (até D+29)
    let applications: AccountsApplications[] = [];
    try {
      applications = await firstValueFrom(this.accountApplicationsService.readByAccount(account.id!));
    } catch {
      applications = [];
    }

    let iofWeighted = 0;

    if (applications && applications.length > 0) {
      const today = new Date();
      let principalTotal = 0;
      let principalXRate = 0;

      for (const app of applications) {
        const principal = Number(app.amountApplied) || 0;
        if (principal <= 0) continue;

        const d0 = new Date(app.dateApplied);
        const days = Math.ceil((today.getTime() - d0.getTime()) / 86400000); // dias corridos

        const rate = this.iofRateFromTable(days); // <<--- usa a TABELA
        principalTotal += principal;
        principalXRate += principal * rate;
      }

      if (principalTotal > 0) {
        iofWeighted = principalXRate / principalTotal;

        // opcional (se saldos variam muito por resgates): 
        // iofWeighted *= Math.min(1, (principalTotal / (Number(account.totalBalanceGross ?? account.totalBalance) || 1)));
      }
    }

    // IOF do dia:
    const iofAmount = grossYield * iofWeighted;

    // IR sobre (bruto - IOF):
    const irBase = Math.max(0, grossYield - iofAmount);
    const netYield = isTaxExempt ? (grossYield - iofAmount)
      : (irBase * (1 - irPercent / 100));

    const trunc2 = (v: number) => Math.trunc(v * 100) / 100;

    return {
      totalGross: trunc2(saldoBruto),
      totalNet: trunc2(saldoBruto + netYield),
      grossYield: trunc2(grossYield),
      netYield: trunc2(netYield),
    };
  }
}
