import { Component, Input, OnChanges } from '@angular/core';
import { AccountService } from 'src/app/services/account/account.service';
import { InvestmentRecommendation, InvestmentStrategyReport } from 'src/app/models/investment-strategy-report.model';

@Component({ selector: 'app-investment-strategy-report', templateUrl: './investment-strategy-report.component.html', styleUrls: ['./investment-strategy-report.component.scss'] })
export class InvestmentStrategyReportComponent implements OnChanges {
  @Input() accountId = 0;
  @Input() initialDate: Date | null = null;
  @Input() finalDate: Date | null = null;
  @Input() reserve: number | null = null;
  report: InvestmentStrategyReport | null = null;
  loading = false;
  error = '';

  constructor(private service: AccountService) {}

  ngOnChanges(): void {
    if (!this.accountId || !this.initialDate || !this.finalDate) return;
    this.loading = true; this.error = ''; this.report = null;
    this.service.getInvestmentStrategyReport(this.accountId, this.initialDate.toISOString(), this.finalDate.toISOString(), this.reserve).subscribe({
      next: response => { this.report = response; this.loading = false; },
      error: error => { this.error = this.readError(error); this.loading = false; this.report = null; }
    });
  }

  recommendations(r: InvestmentStrategyReport): InvestmentRecommendation[] { return r.recommendations ?? []; }
  money(value: number | null | undefined): string { return value == null || !Number.isFinite(value) ? 'R$ 0,00' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  optionalMoney(value: number | null | undefined, empty = 'Sem limite máximo'): string { return value == null || !Number.isFinite(value) ? empty : this.money(value); }
  percent(value: number | null | undefined): string { return value == null || !Number.isFinite(value) ? '0,00%' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`; }
  date(value: string | null | undefined): string { return value ? new Date(value).toLocaleDateString('pt-BR') : 'Sem data'; }
  capacity(value: number | null | undefined): string { return value == null ? 'Sem limite superior' : this.money(value); }
  maximum(value: number | null | undefined): string { return value == null ? 'Sem limite máximo' : this.money(value); }
  range(x: InvestmentRecommendation): string { if (x.rangeStart === 0 && x.rangeEnd != null) return `Até ${this.money(x.rangeEnd)}`; if (x.rangeEnd == null) return `A partir de ${this.money(x.rangeStart)}`; return `De ${this.money(x.rangeStart)} até ${this.money(x.rangeEnd)}`; }
  tax(x: InvestmentRecommendation): string { return x.isDestinationTaxExempt ? 'Isento de IR' : `IR considerado: ${this.percent(x.destinationIrPercent)}`; }
  async copyAnalysis(): Promise<void> {
    if (!this.report) return;

    const r = this.report;
    const lines: string[] = [
      'ESTRATÉGIA DE INVESTIMENTOS',
      '',
      `Conta analisada: ${this.accountId}`,
      `Período: ${this.date(this.initialDate?.toISOString())} a ${this.date(this.finalDate?.toISOString())}`,
      '',
      'RESUMO',
      `Saldo atual: ${this.money(r.currentBalance)}`,
      `Menor saldo projetado: ${this.money(r.lowestBalance)}${r.criticalDate ? ` em ${this.date(r.criticalDate)}` : ''}`,
      `Reserva operacional: ${this.money(r.reserve)}`,
      `Excedente seguro: ${this.money(r.safeSurplus)}`,
      `Transferência recomendada: ${this.money(r.recommendedInvestment)}`,
      `Excedente sem destino: ${this.money(r.safeSurplusWithoutDestination)}`,
      `Valor mantido na conta principal: ${this.money(r.keptInMainAccount)}`,
      `Saldo final projetado: ${this.money(r.finalBalance)}`,
      '',
      'RESERVA OPERACIONAL',
      `Reserva sugerida: ${this.money(r.suggestedReserve)}`,
      `Explicação: ${r.reserveExplanation ?? ''}`,
      `Histórico: ${this.money(r.historicalPaidAmount)} pagos em ${r.historicalDays} dias; média diária ${this.money(r.historicalDailyExpenseAverage)}; cobertura de ${r.reserveCoverageDays} dias; ${this.date(r.historicalStartDate)} a ${this.date(r.historicalEndDate)}`,
      '',
      'RECOMENDAÇÕES'
    ];

    const recommendations = this.recommendations(r);
    if (!recommendations.length) lines.push('Nenhum destino elegível possui capacidade com rendimento líquido superior.');
    recommendations.forEach((x, index) => {
      lines.push(
        `${index + 1}. ${x.accountName} — ${this.money(x.recommendedAmount)}`,
        `Faixa: ${this.range(x)}`,
        `Motivo: ${x.reason}`,
        `Saldo antes/depois: ${this.money(x.destinationBalanceBefore)} / ${this.money(x.destinationBalanceAfter)}`,
        `Limite máximo: ${this.optionalMoney(x.maximumAmount)}; ocupado: ${this.money(x.occupiedAmount)}`,
        `Capacidade antes/depois: ${this.optionalMoney(x.applicationCapacityBefore)} / ${this.optionalMoney(x.applicationCapacityAfter)}`,
        `Faixa antes/depois: ${this.capacity(x.rangeCapacityBefore)} / ${this.capacity(x.rangeCapacityAfter)}`,
        `Rendimento bruto/líquido do destino (${x.destinationYieldIndex}): ${this.percent(x.destinationGrossYield)} / ${this.percent(x.destinationNetYield)}`,
        `Rendimento bruto/líquido da origem (${x.sourceYieldIndex}): ${this.percent(x.sourceGrossYield)} / ${this.percent(x.sourceNetYield)}`,
        `Vantagem líquida: ${this.percent(x.advantagePercent)}; tributação: ${this.tax(x)}`,
        `Base: ${x.capacityBasis}`,
        ''
      );
    });

    const exclusions = r.exclusions ?? [];
    if (exclusions.length) {
      lines.push('CONTAS NÃO ELEGÍVEIS');
      exclusions.forEach(x => lines.push(`${x.accountName}: ${x.reason}`));
      lines.push('');
    }
    const warnings = r.warnings ?? [];
    if (warnings.length) {
      lines.push('AVISOS', ...warnings, '');
    }
    const limitations = r.limitations ?? [];
    if (limitations.length) {
      lines.push('LIMITAÇÕES', ...limitations, '');
    }

    lines.push('LINHA DO TEMPO');
    (r.timeline ?? []).forEach(x => lines.push(
      `${this.date(x.date)} | Receitas: ${this.money(x.income)} | Despesas: ${this.money(x.expense)} | Saldo sem estratégia: ${this.money(x.baseBalance)} | Após estratégia: ${this.money(x.strategyBalance)} | Margem sobre reserva: ${this.money(x.reserveMargin)}${x.isCritical ? ' | CRÍTICO' : ''}`
    ));

    const text = lines.join('\\n').trim();
    try {
      await navigator.clipboard.writeText(text);

    } catch {

    }
  }

  private readError(error: any): string { const value = error?.error?.message ?? error?.error?.detail ?? (typeof error?.error === 'string' ? error.error : error?.message); return typeof value === 'string' && value.trim() ? value : 'Não foi possível gerar a Estratégia de Investimentos.'; }
}
