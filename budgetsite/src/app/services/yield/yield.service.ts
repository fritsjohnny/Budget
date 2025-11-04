import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Messenger } from 'src/app/common/messenger';
import { Accounts } from 'src/app/models/accounts.model';

@Injectable({ providedIn: 'root' })
export class YieldService {
  private cdiCache: number | null = null;

  constructor(private http: HttpClient, private messenger: Messenger) { }

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

  async suggestYield(account: Accounts): Promise<{ grossAmount: number; netAmount: number }> {
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
}
