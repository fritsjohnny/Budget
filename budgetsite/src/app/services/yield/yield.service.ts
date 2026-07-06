import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Messenger } from 'src/app/common/messenger';
import { Accounts } from 'src/app/models/accounts.model';
import { AccountApplicationsService } from '../accountapplications/accountapplications.service';
import { AccountsApplications } from 'src/app/models/accountsapplications.model';
import { AccountYieldRange } from 'src/app/models/accountyieldrange.model';
import { firstValueFrom } from 'rxjs';
import { AccountYieldRangeService } from '../accountyieldrange/accountyieldrange.service';

@Injectable({ providedIn: 'root' })
export class YieldService {
  private cdiCache: number | null = null;

  constructor(
    private http: HttpClient,
    private messenger: Messenger,
    private accountApplicationsService: AccountApplicationsService,
    private accountYieldRangeService: AccountYieldRangeService) { }

  async getCdiDiarioPercentOld(): Promise<number> {
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

  // Propriedades auxiliares (adicione na sua classe)
  private cdiCacheByDate = new Map<string, number>(); // chave: 'YYYY-MM-DD'
  private cdiLastKnown?: number;

  // Helpers locais
  private formatYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatBR(d: Date): string {
    const day = String(d.getDate()).padStart(2, '0');
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = d.getFullYear();
    return `${day}/${m}/${y}`;
  }

  private addDays(d: Date, delta: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + delta);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  /**
   * Retorna o CDI DIÁRIO em percentual do dia (ex.: 0.0551014 para 0,0551014% ao dia).
   * Se 'date' não for informada, usa hoje. Recuará até 7 dias atrás se o BCB não tiver ponto.
   */
  async getCdiDiarioPercent(date?: Date): Promise<number> {
    const start = new Date(date ?? new Date());
    start.setHours(0, 0, 0, 0);

    // 1) Cache por data
    const cacheKey = this.formatYMD(start);
    if (this.cdiCacheByDate.has(cacheKey)) {
      return this.cdiCacheByDate.get(cacheKey)!;
    }

    // 2) Função de busca para um dia específico
    const fetchFor = async (d: Date): Promise<number | null> => {
      const dayBR = this.formatBR(d);
      const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${dayBR}&dataFinal=${dayBR}`;

      try {
        const data = await this.http.get<any[]>(url).toPromise();
        const valorStr = data?.[0]?.valor;
        const valor = parseFloat(String(valorStr).replace(',', '.'));
        if (isNaN(valor)) return null;

        // Guarda em cache específico da data e como "último conhecido"
        const key = this.formatYMD(d);
        this.cdiCacheByDate.set(key, valor);
        this.cdiLastKnown = valor;
        return valor;
      } catch {
        return null;
      }
    };

    // 3) Tenta na data pedida; se não tiver ponto, recua até 7 dias
    let d = start;
    for (let i = 0; i < 7; i++) {
      const v = await fetchFor(d);
      if (v != null) return v;
      d = this.addDays(d, -1);
    }

    // 4) Fallback final: usa o último valor conhecido (se houver) ou lança erro
    if (typeof this.cdiLastKnown === 'number') {
      // opcional: também cacheia na data solicitada
      this.cdiCacheByDate.set(cacheKey, this.cdiLastKnown);
      return this.cdiLastKnown;
    }

    throw new Error('CDI diário indisponível para a data informada.');
  }

  async getCdiDiarioPercentStrict(date: Date): Promise<number | null> {
    const target = new Date(date);
    target.setHours(0, 0, 0, 0);

    const cacheKey = this.formatYMD(target);

    if (this.cdiCacheByDate.has(cacheKey)) {
      return this.cdiCacheByDate.get(cacheKey)!;
    }

    const dayBR = this.formatBR(target);
    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${dayBR}&dataFinal=${dayBR}`;

    try {
      const data = await this.http.get<any[]>(url).toPromise();
      const valorStr = data?.[0]?.valor;
      const valor = parseFloat(String(valorStr).replace(',', '.'));

      if (isNaN(valor)) {
        return null;
      }

      this.cdiCacheByDate.set(cacheKey, valor);
      this.cdiLastKnown = valor;

      return valor;
    } catch {
      return null;
    }
  }

  // IOF por dia corrido (1..29). 30+ => 0
  IOF_TABLE: number[] = [
    // 0,     // 0 (não usado)
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

  // Helpers de dia útil (sem feriados; se quiser, injete um calendário depois)
  isWeekend(d: Date): boolean {
    const w = d.getDay();
    return w === 0 || w === 6; // 0=Dom, 6=Sáb
  }

  private getActiveApplications(
    launchDate: Date,
    applications: AccountsApplications[]
  ): AccountsApplications[] {
    if (!applications || applications.length === 0) {
      return [];
    }

    const referenceDate = new Date(launchDate);
    referenceDate.setHours(0, 0, 0, 0);

    return applications.filter(app => {
      const amountApplied = Number(app.amountApplied || 0);

      if (amountApplied <= 0) {
        return false;
      }

      if (!app.maturityDate) {
        return true;
      }

      const maturityDate = new Date(app.maturityDate);
      maturityDate.setHours(0, 0, 0, 0);

      return maturityDate >= referenceDate;
    });
  }

  private hasActiveApplications(launchDate: Date, applications: AccountsApplications[]): boolean {
    return this.getActiveApplications(launchDate, applications).length > 0;
  }

  private shouldGenerateGrossYieldForMercadoPago(
    launchDate: Date,
    applications: AccountsApplications[],
    previousBusinessDayHoliday: boolean
  ): boolean {
    const hasActiveApplications = this.hasActiveApplications(launchDate, applications);

    if (!hasActiveApplications) {
      return true;
    }

    if (previousBusinessDayHoliday) {
      return false;
    }

    const previousDay = this.addDays(new Date(launchDate), -1);

    return !this.isWeekend(previousDay);
  }

  nthPreviousBusinessDay(base: Date, n: number): Date {
    let d = new Date(base);
    d.setHours(0, 0, 0, 0);
    let count = 0;
    while (count < n) {
      d = this.addDays(d, -1);
      if (!this.isWeekend(d)) count++;
    }
    // se cair em fim de semana por acaso (ex.: n=0 e hoje é domingo), recua até sexta
    while (this.isWeekend(d)) d = this.addDays(d, -1);
    return d;
  }

  // Wrapper que resolve a data-alvo da taxa conforme a política da conta
  async getCdiDiarioPercentByAccountPolicy(account: Accounts): Promise<number> {
    debugger
    // prioridade: campo novo; fallback para isD0 (retrocompat.)
    const lagDays = Number((account as any).cdiRateLagDays ?? ((account as any).isD0 ? 0 : 1));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let targetDate: Date;
    if (lagDays <= 0) {
      // D0: se hoje for fim de semana, recua até sexta (último dia útil com CDI publicado)
      targetDate = this.isWeekend(today) ? this.nthPreviousBusinessDay(today, 1) : today;
    } else {
      // D-N úteis
      targetDate = this.nthPreviousBusinessDay(today, lagDays);
    }

    // Ideal: sua função aceitar a data. Se ainda não aceitar, crie uma sobrecarga simples.
    // Exemplo esperado: this.getCdiDiarioPercent(targetDate)
    return await this.getCdiDiarioPercent(targetDate);
  }

  // Helper: decide a data-alvo da taxa (0 = D0, 1 = D-1 útil, etc.)
  resolveCdiTargetDate(account: Accounts): Date {
    const lag = Number((account as any).cdiRateLagDays ?? ((account as any).isD0 ? 0 : 1));
    const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
    const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); x.setHours(0, 0, 0, 0); return x; };

    let target = new Date(); target.setHours(0, 0, 0, 0);
    if (lag > 0) {
      let count = 0;
      while (count < lag) {
        target = addDays(target, -1);
        if (!isWeekend(target)) count++;
      }
    } else if (isWeekend(target)) {
      while (isWeekend(target)) target = addDays(target, -1);
    }
    return target;
  }

  async suggestYield1(account: Accounts): Promise<{
    totalGross: number;
    totalNet: number;
    grossYield: number;
    netYield: number;
    iofTotal: number;
    irTotal: number;
    totalAplicado: number;
  }> {
    if (!account || !account.yieldPercent)
      return { totalGross: 0, totalNet: 0, grossYield: 0, netYield: 0, iofTotal: 0, irTotal: 0, totalAplicado: 0 };

    const yieldPercent = Number(account.yieldPercent);
    const irPercent = Number(account.irPercent ?? 22.5);
    const isTaxExempt = account.isTaxExempt ?? false;

    // CDI do dia-alvo (D0/D-1…)
    let cdiDiarioPercent = 0;
    try {
      const targetDate = this.resolveCdiTargetDate(account);
      cdiDiarioPercent = await this.getCdiDiarioPercent(targetDate);
    } catch {
      this.messenger.errorHandler('Erro ao obter CDI diário. Usando último rendimento.');
      return {
        totalGross: account.totalBalanceGross ?? 0,
        totalNet: account.totalBalance ?? 0,
        grossYield: account.lastYield ?? 0,
        netYield: account.lastYield ?? 0,
        iofTotal: 0,
        irTotal: 0,
        totalAplicado: account.totalBalanceGross ?? 0,
      };
    }

    // helpers em centavos
    const toCents = (v: number) => Math.round(v * 100);
    const fromCents = (c: number) => c / 100;

    // bases em centavos (evita drift binário)
    const baseGrossC = toCents(Number(account.totalBalanceGross ?? account.totalBalance) || 0);
    const baseNetC = toCents(Number(account.totalBalance ?? account.totalBalanceGross) || 0);

    // taxa aplicada do dia
    const cdiDiario = cdiDiarioPercent / 100;                  // ex.: 0.055% => 0.00055
    const taxaAplicada = cdiDiario * (yieldPercent / 100);     // ex.: 120% do CDI

    // rendimento bruto do dia (centavos)
    const grossRaw = (baseGrossC / 100) * taxaAplicada;        // em reais (float)
    const grossC = toCents(grossRaw);                         // arredonda para 2 casas

    // --- IOF regressivo ponderado por principal (mantido) ---
    let applications: AccountsApplications[] = [];
    try {
      applications = await firstValueFrom(this.accountApplicationsService.readByAccount(account.id!));
    } catch {
      applications = [];
    }

    let principalTotal = 0;

    let iofWeighted = 0;
    if (applications && applications.length > 0) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      let principalXRate = 0;

      for (const app of applications) {
        const principal = Number(app.amountApplied) || 0;
        if (principal <= 0) continue;

        const d0 = new Date(app.dateApplied); d0.setHours(0, 0, 0, 0);
        const days = Math.ceil((today.getTime() - d0.getTime()) / 86400000); // dias corridos
        const rate = this.iofRateFromTable(days); // usa a tabela IOF
        principalTotal += principal;
        principalXRate += principal * rate;
      }

      if (principalTotal > 0) {
        iofWeighted = principalXRate / principalTotal;
      }
    }
    else {
      principalTotal = baseGrossC; // se não tiver aplicações, considera o saldo atual como "principal" para ponderar o IOF
    }

    // degraus em centavos (alinha com bancos)
    const iofC = toCents((grossC / 100) * iofWeighted);                     // IOF sobre gross
    const irBaseC = grossC - iofC;                                             // base de IR (centavos)
    const irC = isTaxExempt ? 0 : Math.floor((irBaseC * irPercent) / 100); // **TRUNCA** IR
    const netC = grossC - iofC - irC;                                       // líquido do dia

    // totais em centavos → reais
    const totalGrossC = baseGrossC + grossC;
    const totalNetC = baseNetC + netC;

    return {
      totalGross: fromCents(totalGrossC),
      totalNet: fromCents(totalNetC),
      grossYield: fromCents(grossC),
      netYield: fromCents(netC),
      iofTotal: fromCents(iofC),
      irTotal: fromCents(irC),
      totalAplicado: fromCents(principalTotal),
    };
  }

  async suggestYield2(account: Accounts): Promise<{
    totalGross: number;
    totalNet: number;
    grossYield: number;
    netYield: number;
    iofTotal: number;
    irTotal: number;
    totalAplicado: number;
  }> {
    if (!account || !account.yieldPercent)
      return { totalGross: 0, totalNet: 0, grossYield: 0, netYield: 0, iofTotal: 0, irTotal: 0, totalAplicado: 0 };

    const yieldPercent = Number(account.yieldPercent);    // ex.: 107, 108
    const irPercent = Number(account.irPercent ?? 22.5);
    const isTaxExempt = account.isTaxExempt ?? false;

    // CDI do dia-alvo (D0/D-1…)
    let cdiDiarioPercent = 0;
    try {
      const targetDate = this.resolveCdiTargetDate(account);
      cdiDiarioPercent = await this.getCdiDiarioPercent(targetDate);
    } catch {
      this.messenger.errorHandler('Erro ao obter CDI diário. Usando último rendimento.');
      return {
        totalGross: account.totalBalanceGross ?? 0,
        totalNet: account.totalBalance ?? 0,
        grossYield: account.lastYield ?? 0,
        netYield: account.lastYield ?? 0,
        iofTotal: 0,
        irTotal: 0,
        totalAplicado: account.totalBalanceGross ?? 0,
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

    let principalTotal = 0;

    if (applications && applications.length > 0) {
      const today = new Date();
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
    else {
      principalTotal = account.totalBalanceGross ?? account.totalBalance ?? 0; // se não tiver aplicações, considera o saldo atual como "principal" para ponderar o IOF
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
      iofTotal: trunc2(iofAmount),
      irTotal: trunc2(irBase * (irPercent / 100)),
      totalAplicado: trunc2(principalTotal),
    };
  }

  // async suggestYield3(account: Accounts): Promise<{
  //   totalGross: number;
  //   totalNet: number;
  //   grossYield: number;
  //   netYield: number;
  //   iofTotal: number;
  //   irTotal: number;
  //   totalAplicado: number;
  // }> {
  //   if (!account || !account.yieldPercent) {
  //     return { totalGross: 0, totalNet: 0, grossYield: 0, netYield: 0, iofTotal: 0, irTotal: 0, totalAplicado: 0 };
  //   }

  //   const yieldPercent = Number(account.yieldPercent);      // ex.: 107
  //   const irPercent = Number(account.irPercent ?? 22.5);
  //   const isTaxExempt = account.isTaxExempt ?? false;

  //   // helpers
  //   const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
  //   const toCents = (v: number) => Math.round(v * 100);
  //   const fromCents = (c: number) => c / 100;

  //   // 1) CDI do dia-alvo
  //   let cdiDiarioPercent = 0;
  //   try {
  //     const targetDate = this.resolveCdiTargetDate(account); // p/ Mercado Pago deixe cdiRateLagDays=0 (D0) no cadastro
  //     cdiDiarioPercent = await this.getCdiDiarioPercent(targetDate);
  //   } catch {
  //     this.messenger.errorHandler('Erro ao obter CDI diário. Usando último rendimento.');
  //     return {
  //       totalGross: account.totalBalanceGross ?? 0,
  //       totalNet: account.totalBalance ?? 0,
  //       grossYield: account.lastYield ?? 0,
  //       netYield: account.lastYield ?? 0,
  //       iofTotal: 0,
  //       irTotal: 0,
  //       totalAplicado: account.totalBalanceGross ?? 0,
  //     };
  //   }

  //   // 2) Base (usar valor exibido para evitar drift)
  //   const baseGrossDisplay = round2(Number(account.totalBalanceGross ?? account.totalBalance) || 0);
  //   const baseNetDisplay = round2(Number(account.totalBalance ?? account.totalBalanceGross) || 0);

  //   // 3) Taxa aplicada do dia
  //   const cdiDiario = cdiDiarioPercent / 100;                 // ex.: 0.055% -> 0.00055
  //   const taxaAplicada = cdiDiario * (yieldPercent / 100);       // ex.: 107% do CDI

  //   // 4) Rendimento BRUTO "cru" (sem arredondar ainda)
  //   const grossYieldRaw = baseGrossDisplay * taxaAplicada;

  //   // 5) IOF regressivo ponderado APENAS pelos aportes dentro de D+29, escalonado pela fração do saldo sob IOF
  //   let applications: AccountsApplications[] = [];
  //   try {
  //     applications = await firstValueFrom(this.accountApplicationsService.readByAccount(account.id!));
  //   } catch { applications = []; }

  //   let principalTotal = 0;   // soma total (apenas p/ telemetria se quiser)
  //   let iofWeightedEffective = 0;

  //   if (applications && applications.length > 0) {
  //     const today = new Date(); today.setHours(0, 0, 0, 0);

  //     let principalInWindow = 0;   // soma dos aportes dentro de D+29
  //     let principalXRate = 0;   // soma(aporte * taxaIOF(do dia))

  //     for (const app of applications) {
  //       const principal = Number(app.amountApplied) || 0;
  //       if (principal <= 0) continue;

  //       principalTotal += principal;

  //       const d0 = new Date(app.dateApplied); d0.setHours(0, 0, 0, 0);
  //       const days = Math.ceil((today.getTime() - d0.getTime()) / 86400000); // dias corridos
  //       const rate = this.iofRateFromTable(days); // 1.00 (D0) ... 0.00 (>=D+30)

  //       if (days <= 29) { // considera apenas dentro da janela de IOF
  //         principalInWindow += principal;
  //         principalXRate += principal * rate;
  //       }
  //     }

  //     if (principalInWindow > 0) {
  //       const avgIofOnWindow = principalXRate / principalInWindow;                       // média ponderada dos "recentes"
  //       const fractionOnIof = Math.min(1, principalInWindow / (baseGrossDisplay || 1)); // fração do saldo sob IOF
  //       iofWeightedEffective = avgIofOnWindow * fractionOnIof;                           // IOF efetivo sobre o rendimento
  //     }
  //   }
  //   else {
  //     principalTotal = baseGrossDisplay; // se não tiver aplicações, considera o saldo atual como "principal" para ponderar o IOF
  //   }

  //   // 6) Pipeline do LÍQUIDO em centavos (estável) — IR TRUNCADO
  //   const grossC = toCents(grossYieldRaw);                           // arredonda p/ exibir "Valor Bruto"
  //   const iofC = toCents(grossYieldRaw * iofWeightedEffective);    // IOF sobre o BRUTO CRU
  //   const irBaseC = grossC - iofC;
  //   const irC = isTaxExempt ? 0 : Math.floor((irBaseC * irPercent) / 100); // IR truncado (centavos)
  //   const netC = grossC - iofC - irC;

  //   // 7) Totais (Mercado Pago exibe líquido total; vamos calcular ambos)
  //   const totalGross = round2(baseGrossDisplay + fromCents(grossC)); // bruto: saldo + rendimento arredondado
  //   const totalNet = round2(baseNetDisplay + fromCents(netC));   // líquido: saldo + líquido do dia

  //   return {
  //     totalGross,
  //     totalNet,
  //     grossYield: fromCents(grossC),
  //     netYield: fromCents(netC),
  //     iofTotal: fromCents(iofC),
  //     irTotal: fromCents(irC),
  //     totalAplicado: round2(principalTotal),
  //   };
  // }

  private async getYieldRanges(accountId?: number): Promise<AccountYieldRange[]> {
    if (!accountId) {
      return [];
    }

    try {
      const ranges = await firstValueFrom(this.accountYieldRangeService.readByAccount(accountId));

      return (ranges ?? []).sort((a, b) => a.position - b.position);
    } catch {
      return [];
    }
  }

  private calculateGrossYieldByRanges(
    baseGross: number,
    cdiDiario: number,
    defaultYieldPercent: number,
    ranges: AccountYieldRange[]
  ): number {
    const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

    if (!ranges || ranges.length === 0) {
      return round2(baseGross * cdiDiario * (defaultYieldPercent / 100));
    }

    let grossYield = 0;

    for (const range of ranges) {
      const startAmount = Number(range.startAmount || 0);
      const endAmount = range.endAmount === null || range.endAmount === undefined
        ? baseGross
        : Number(range.endAmount);

      if (baseGross <= startAmount) {
        continue;
      }

      const amountInRange = Math.max(0, Math.min(baseGross, endAmount) - startAmount);

      if (amountInRange <= 0) {
        continue;
      }

      grossYield += amountInRange * cdiDiario * (Number(range.yieldPercent || 0) / 100);
    }

    return round2(grossYield);
  }

  async suggestYield3(
    account: Accounts,
    launchDate: Date,
    iofElapsedDays: number,
    previousYield: number,
    previousBusinessDayHoliday: boolean = false
  ): Promise<{
    totalGross: number;
    totalNet: number;
    grossYield: number;
    netYield: number;
    iofTotal: number;
    irTotal: number;
    totalAplicado: number;
  }> {
    if (!account || !account.yieldPercent) {
      return { totalGross: 0, totalNet: 0, grossYield: 0, netYield: 0, iofTotal: 0, irTotal: 0, totalAplicado: 0 };
    }

    const yieldPercent = Number(account.yieldPercent);
    const irPercent = Number(account.irPercent ?? 22.5);
    const isTaxExempt = account.isTaxExempt ?? false;

    const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
    const trunc2 = (v: number) => Math.trunc(v * 100) / 100;

    const baseGross = round2(Number(account.totalBalanceGross ?? account.totalBalance) || 0);
    const baseNet = round2(Number(account.totalBalance ?? account.totalBalanceGross) || 0);
    const daysForIof = Math.max(0, Math.trunc(Number(iofElapsedDays || 0)));

    let applications: AccountsApplications[] = [];

    try {
      applications = await firstValueFrom(this.accountApplicationsService.readByAccount(account.id!));
    } catch {
      applications = [];
    }

    const activeApplications = this.getActiveApplications(launchDate, applications);
    const hasActiveApplications = activeApplications.length > 0;
    const previousNetAccumulated = hasActiveApplications
      ? round2(Number(previousYield || 0))
      : 0;

    let principalTotal = 0;

    if (hasActiveApplications) {
      for (const app of activeApplications) {
        const principal = Number(app.amountApplied) || 0;

        if (principal > 0) {
          principalTotal += principal;
        }
      }
    } else {
      principalTotal = baseGross;
    }

    principalTotal = round2(principalTotal);

    let grossYieldDay = 0;

    const shouldGenerateGrossYield = this.shouldGenerateGrossYieldForMercadoPago(
      launchDate,
      activeApplications,
      previousBusinessDayHoliday
    );

    if (shouldGenerateGrossYield) {
      const targetDate = this.resolveCdiTargetDate(account);
      const cdiDiarioPercent = await this.getCdiDiarioPercentStrict(targetDate);

      if (cdiDiarioPercent !== null) {
        const cdiDiario = cdiDiarioPercent / 100;
        const ranges = await this.getYieldRanges(account.id);

        grossYieldDay = this.calculateGrossYieldByRanges(
          baseGross,
          cdiDiario,
          yieldPercent,
          ranges
        );
      }
    }

    const totalGross = round2(baseGross + grossYieldDay);
    const totalYieldGrossNow = Math.max(0, round2(totalGross - principalTotal));

    let iofRateEffective = 0;

    if (hasActiveApplications) {
      let principalInWindow = 0;
      let principalXRate = 0;

      for (const app of activeApplications) {
        const principal = Number(app.amountApplied) || 0;

        if (principal <= 0) {
          continue;
        }

        const rate = this.iofRateFromTable(daysForIof);

        if (daysForIof <= 29) {
          principalInWindow += principal;
          principalXRate += round2(principal * rate);
        }
      }

      if (principalInWindow > 0) {
        const avgIofOnWindow = round2(principalXRate / principalInWindow);
        const fractionOnIof = round2(Math.min(1, principalInWindow / (totalGross || 1)));

        iofRateEffective = activeApplications.length > 1 ? round2(avgIofOnWindow * fractionOnIof) : avgIofOnWindow;
      }
    }

    const iofTotal = round2(totalYieldGrossNow * iofRateEffective);
    const irBase = round2(Math.max(0, totalYieldGrossNow - iofTotal));
    const irTotal = isTaxExempt ? 0 : trunc2(irBase * (irPercent / 100));
    const netAccumulatedNow = round2(totalYieldGrossNow - iofTotal - irTotal);
    const netYieldDay = round2(netAccumulatedNow - previousNetAccumulated);

    return {
      totalGross,
      totalNet: round2(baseNet + netYieldDay),
      grossYield: grossYieldDay,
      netYield: netYieldDay,
      iofTotal,
      irTotal,
      totalAplicado: principalTotal,
    };
  }

  async suggestYield4(
    account: Accounts,
    launchDate: Date,
    iofElapsedDays: number,
    previousYield: number
  ): Promise<{
    totalGross: number;
    totalNet: number;
    grossYield: number;
    netYield: number;
    iofTotal: number;
    irTotal: number;
    totalAplicado: number;
  }> {
    if (!account || !account.yieldPercent) {
      return { totalGross: 0, totalNet: 0, grossYield: 0, netYield: 0, iofTotal: 0, irTotal: 0, totalAplicado: 0 };
    }

    const yieldPercent = Number(account.yieldPercent);
    const irPercent = Number(account.irPercent ?? 22.5);
    const isTaxExempt = account.isTaxExempt ?? false;

    const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
    const trunc2 = (v: number) => Math.trunc(v * 100) / 100;

    // 1) CDI diário do dia-alvo
    let cdiDiarioPercent = 0;
    try {
      // mantém sua regra de “qual data buscar CDI”
      // (normalmente CDI do último dia útil / fechamento)
      const targetDate = this.resolveCdiTargetDate(account);
      cdiDiarioPercent = await this.getCdiDiarioPercent(targetDate);
    } catch {
      // fallback conservador
      this.messenger.errorHandler('Erro ao obter CDI diário. Usando último rendimento.');
      return {
        totalGross: account.totalBalanceGross ?? 0,
        totalNet: account.totalBalance ?? 0,
        grossYield: account.lastYield ?? 0,
        netYield: account.lastYield ?? 0,
        iofTotal: 0,
        irTotal: 0,
        totalAplicado: account.totalBalanceGross ?? 0,
      };
    }

    // 2) Saldos base (antes do rendimento do dia)
    const baseGross = round2(Number(account.totalBalanceGross ?? account.totalBalance) || 0);
    const baseNet = round2(Number(account.totalBalance ?? account.totalBalanceGross) || 0);

    // 3) Rendimento BRUTO do dia (igual aos outros bancos: saldo_base * taxa_diária * (%CDI))
    const cdiDiario = cdiDiarioPercent / 100;
    const taxaAplicada = cdiDiario * (yieldPercent / 100);
    const grossYieldDay = round2(baseGross * taxaAplicada);

    // 4) Pega aplicações apenas para estimar “IOF efetivo” sobre o total de rendimento acumulado
    //    (a diferença é que NÃO vamos mais recalcular ‘ontem’ — isso vem por parâmetro)
    let applications: AccountsApplications[] = [];
    try {
      applications = await firstValueFrom(this.accountApplicationsService.readByAccount(account.id!));
    } catch {
      applications = [];
    }

    // Principal total (aprox) = soma das aplicações
    // Se não houver aplicações, não dá pra inferir IOF corretamente -> fallback conservador
    let principalTotal = 0;
    if (applications && applications.length > 0) {
      for (const app of applications) {
        const p = Number(app.amountApplied) || 0;
        if (p > 0) principalTotal += p;
      }
    } else {
      // sem aplicações: assume que não há rendimento acumulado identificável (principal ≈ saldo bruto base)
      principalTotal = baseGross;
    }

    // 5) Rendimento bruto ACUMULADO após o crédito do dia (estimado)
    //    totalYieldGrossNow = (saldo_bruto_apos_credito) - principal
    const grossEndNow = round2(baseGross + grossYieldDay);
    const totalYieldGrossNow = Math.max(0, round2(grossEndNow - principalTotal));

    // 6) Calcula o LÍQUIDO ACUMULADO “agora” (IOF + IR sobre o acumulado)
    //    IMPORTANTE: o “do dia” será a diferença para o acumulado anterior (prevNetAccumulated).
    const calcNetAccumulated = (totalYieldGross: number, refDate: Date, baseForFraction: number) => {
      // IOF efetivo ponderado: olha as aplicações com <= 29 dias corridos (tabela IOF)
      let principalInWindow = 0;
      let principalXRate = 0;

      if (applications && applications.length > 0) {
        for (const app of applications) {
          const principal = Number(app.amountApplied) || 0;
          if (principal <= 0) continue;

          const d0 = new Date(app.dateApplied);
          d0.setHours(0, 0, 0, 0);

          // dias corridos inclusivo (D+1)
          const rate = this.iofRateFromTable(iofElapsedDays);

          if (iofElapsedDays <= 29) {
            principalInWindow += principal;
            principalXRate += round2(principal * rate);
          }
        }
      }

      let iofRateEff = 0;
      if (principalInWindow > 0) {
        const avgIofOnWindow = round2(principalXRate / principalInWindow);

        // fração do saldo que está sujeito a IOF (não pode exceder 100%)
        // usa baseForFraction = saldo bruto “após crédito” do dia
        const fractionOnIof = round2(Math.min(1, principalInWindow / (baseForFraction || 1)));
        iofRateEff = applications.length > 1 ? round2(avgIofOnWindow * fractionOnIof) : avgIofOnWindow;
      }

      const iofTotal = round2(totalYieldGross * iofRateEff);
      const irBase = round2(Math.max(0, totalYieldGross - iofTotal));
      const irTotal = isTaxExempt ? 0 : trunc2(irBase * (irPercent / 100));
      const netTotal = round2(totalYieldGross - iofTotal - irTotal);

      return { iofTotal, netTotal, irTotal };
    };

    // referência do lançamento (o dia do crédito)
    const ref = new Date(launchDate);
    ref.setHours(0, 0, 0, 0);

    // líquido acumulado “agora”
    const calculated = calcNetAccumulated(totalYieldGrossNow, ref, grossEndNow);

    // 7) LÍQUIDO DO DIA = (líquido acumulado agora) - (líquido acumulado anterior vindo da tela)
    const netYieldDay = round2(calculated.netTotal - previousYield); // diferença para o líquido acumulado anterior (que vem da tela)

    // 8) Totais exibidos no modal
    // (mantém seu contrato atual: totalNet = baseNet + netYieldDay, etc.)
    const saldoBruto = round2(baseGross + grossYieldDay);
    const saldoLiquido = round2(baseNet + netYieldDay);

    return {
      totalGross: saldoBruto,
      totalNet: saldoLiquido,
      grossYield: grossYieldDay,
      netYield: netYieldDay,
      iofTotal: calculated.iofTotal,
      irTotal: calculated.irTotal,
      totalAplicado: principalTotal,
    };
  }


}
