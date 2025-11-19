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
      cdiDiarioPercent = await this.getCdiDiarioPercentOld();
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

  // Helpers de dia útil (sem feriados; se quiser, injete um calendário depois)
  isWeekend(d: Date): boolean {
    const w = d.getDay();
    return w === 0 || w === 6; // 0=Dom, 6=Sáb
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

  async suggestYield(account: Accounts): Promise<{
    totalGross: number;
    totalNet: number;
    grossYield: number;
    netYield: number;
  }> {
    if (!account || !account.yieldPercent)
      return { totalGross: 0, totalNet: 0, grossYield: 0, netYield: 0 };

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

    let iofWeighted = 0;
    if (applications && applications.length > 0) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      let principalTotal = 0;
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
    };
  }

  async suggestYield2(account: Accounts): Promise<{
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

  async suggestYield3(account: Accounts): Promise<{
    totalGross: number;
    totalNet: number;
    grossYield: number;
    netYield: number;
  }> {
    if (!account || !account.yieldPercent) {
      return { totalGross: 0, totalNet: 0, grossYield: 0, netYield: 0 };
    }

    const yieldPercent = Number(account.yieldPercent);      // ex.: 107
    const irPercent = Number(account.irPercent ?? 22.5);
    const isTaxExempt = account.isTaxExempt ?? false;

    // helpers
    const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
    const toCents = (v: number) => Math.round(v * 100);
    const fromCents = (c: number) => c / 100;

    // 1) CDI do dia-alvo
    let cdiDiarioPercent = 0;
    try {
      const targetDate = this.resolveCdiTargetDate(account); // p/ Mercado Pago deixe cdiRateLagDays=0 (D0) no cadastro
      cdiDiarioPercent = await this.getCdiDiarioPercent(targetDate);
    } catch {
      this.messenger.errorHandler('Erro ao obter CDI diário. Usando último rendimento.');
      return {
        totalGross: account.totalBalanceGross ?? 0,
        totalNet: account.totalBalance ?? 0,
        grossYield: account.lastYield ?? 0,
        netYield: account.lastYield ?? 0,
      };
    }

    // 2) Base (usar valor exibido para evitar drift)
    const baseGrossDisplay = round2(Number(account.totalBalanceGross ?? account.totalBalance) || 0);
    const baseNetDisplay = round2(Number(account.totalBalance ?? account.totalBalanceGross) || 0);

    // 3) Taxa aplicada do dia
    const cdiDiario = cdiDiarioPercent / 100;                 // ex.: 0.055% -> 0.00055
    const taxaAplicada = cdiDiario * (yieldPercent / 100);       // ex.: 107% do CDI

    // 4) Rendimento BRUTO "cru" (sem arredondar ainda)
    const grossYieldRaw = baseGrossDisplay * taxaAplicada;

    // 5) IOF regressivo ponderado APENAS pelos aportes dentro de D+29, escalonado pela fração do saldo sob IOF
    let applications: AccountsApplications[] = [];
    try {
      applications = await firstValueFrom(this.accountApplicationsService.readByAccount(account.id!));
    } catch { applications = []; }

    let iofWeightedEffective = 0;
    if (applications && applications.length > 0) {
      const today = new Date(); today.setHours(0, 0, 0, 0);

      let principalInWindow = 0;   // soma dos aportes dentro de D+29
      let principalXRate = 0;   // soma(aporte * taxaIOF(do dia))
      let principalTotal = 0;   // soma total (apenas p/ telemetria se quiser)

      for (const app of applications) {
        const principal = Number(app.amountApplied) || 0;
        if (principal <= 0) continue;

        principalTotal += principal;

        const d0 = new Date(app.dateApplied); d0.setHours(0, 0, 0, 0);
        const days = Math.ceil((today.getTime() - d0.getTime()) / 86400000); // dias corridos
        const rate = this.iofRateFromTable(days); // 1.00 (D0) ... 0.00 (>=D+30)

        if (days <= 29) { // considera apenas dentro da janela de IOF
          principalInWindow += principal;
          principalXRate += principal * rate;
        }
      }

      if (principalInWindow > 0) {
        const avgIofOnWindow = principalXRate / principalInWindow;                       // média ponderada dos "recentes"
        const fractionOnIof = Math.min(1, principalInWindow / (baseGrossDisplay || 1)); // fração do saldo sob IOF
        iofWeightedEffective = avgIofOnWindow * fractionOnIof;                           // IOF efetivo sobre o rendimento
      }
    }

    // 6) Pipeline do LÍQUIDO em centavos (estável) — IR TRUNCADO
    const grossC = toCents(grossYieldRaw);                           // arredonda p/ exibir "Valor Bruto"
    const iofC = toCents(grossYieldRaw * iofWeightedEffective);    // IOF sobre o BRUTO CRU
    const irBaseC = grossC - iofC;
    const irC = isTaxExempt ? 0 : Math.floor((irBaseC * irPercent) / 100); // IR truncado (centavos)
    const netC = grossC - iofC - irC;

    // 7) Totais (Mercado Pago exibe líquido total; vamos calcular ambos)
    const totalGross = round2(baseGrossDisplay + fromCents(grossC)); // bruto: saldo + rendimento arredondado
    const totalNet = round2(baseNetDisplay + fromCents(netC));   // líquido: saldo + líquido do dia

    return {
      totalGross,
      totalNet,
      grossYield: fromCents(grossC),
      netYield: fromCents(netC),
    };
  }
}
