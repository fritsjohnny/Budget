import { Component, Input, OnChanges } from '@angular/core';
import { AccountService } from 'src/app/services/account/account.service';
import { InvestmentRecommendation, InvestmentStrategyReport, InvestmentTargetConfiguration } from 'src/app/models/investment-strategy-report.model';

@Component({ selector: 'app-investment-strategy-report', templateUrl: './investment-strategy-report.component.html', styleUrls: ['./investment-strategy-report.component.scss'] })
export class InvestmentStrategyReportComponent implements OnChanges {
  @Input() accountId = 0;
  @Input() initialDate: Date | null = null;
  @Input() finalDate: Date | null = null;
  @Input() reserve: number | null = null;
  @Input() targetConfiguration: InvestmentTargetConfiguration | null = null;
  report: InvestmentStrategyReport | null = null;
  loading = false;
  error = '';

  constructor(private service: AccountService) {}

  ngOnChanges(): void {
    if (!this.accountId || !this.initialDate || !this.finalDate) return;
    this.loading = true; this.error = ''; this.report = null;
    this.service.getInvestmentStrategyReport(this.accountId, this.initialDate.toISOString(), this.finalDate.toISOString(), this.reserve, this.targetConfiguration).subscribe({
      next: response => { this.report = response; this.loading = false; },
      error: error => { this.error = this.readError(error); this.loading = false; this.report = null; }
    });
  }

  recommendations(r: InvestmentStrategyReport): InvestmentRecommendation[] { return r.recommendations ?? []; }
  money(value: number | null | undefined): string { return value == null || !Number.isFinite(value) ? 'R$ 0,00' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  optionalMoney(value: number | null | undefined, empty = 'Sem limite máximo'): string { return value == null || !Number.isFinite(value) ? empty : this.money(value); }
  percent(value: number | null | undefined): string { return value == null || !Number.isFinite(value) ? '0,00%' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`; }
  dailyPercent(value: number | null | undefined): string { return value == null || !Number.isFinite(value) ? 'Indisponível' : `${value.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}%`; }
  date(value: string | null | undefined): string { return value ? new Date(value).toLocaleDateString('pt-BR') : 'Sem data'; }
  capacity(value: number | null | undefined): string { return value == null ? 'Sem limite superior' : this.money(value); }
  maximum(value: number | null | undefined): string { return value == null ? 'Sem limite máximo' : this.money(value); }
  range(x: InvestmentRecommendation): string { if (x.rangeStart === 0 && x.rangeEnd != null) return `Até ${this.money(x.rangeEnd)}`; if (x.rangeEnd == null) return `A partir de ${this.money(x.rangeStart)}`; return `De ${this.money(x.rangeStart)} até ${this.money(x.rangeEnd)}`; }
  tax(x: InvestmentRecommendation): string { return x.isDestinationTaxExempt ? 'Isento de IR' : `IR inicial do novo aporte: ${this.percent(x.destinationIrPercent)}`; }
  sourceTax(x: InvestmentRecommendation): string { return x.sourceDateApplied ? `IR atual: ${this.percent(x.sourceIrPercent)} · ${x.sourceAgeDays ?? 0} dias` : `IR considerado: ${this.percent(x.sourceIrPercent)}`; }
  async copyAnalysis(): Promise<void> {
    if (!this.report) return;

    const r = this.report;
    const lines: string[] = [
      'ESTRATÉGIA DE INVESTIMENTOS',
      '',
      `Conta analisada: ${this.accountId}`,
      `Período: ${this.date(this.initialDate?.toISOString())} a ${this.date(this.finalDate?.toISOString())}`,
      `Destino: ${this.targetConfiguration ? `conta ${this.targetConfiguration.accountId} com condições informadas` : 'automático'}`,
      '',
      'RESUMO',
      `Saldo atual: ${this.money(r.currentBalance)}`,
      `Menor saldo projetado: ${this.money(r.lowestBalance)}${r.criticalDate ? ` em ${this.date(r.criticalDate)}` : ''}`,
      `Reserva operacional: ${this.money(r.reserve)}`,
      `Excedente seguro: ${this.money(r.safeSurplus)}`,
      `Realocação recomendada na carteira: ${this.money(r.recommendedInvestment)}`,
      `Saída recomendada da conta principal: ${this.money(r.mainAccountOutflow)}`,
      `Entrada recomendada na conta principal: ${this.money(r.mainAccountInflow)}`,
      `Origem em outras contas: ${this.money(r.otherAccountsRecommendedInvestment)}`,
      `Excedente da conta principal sem destino: ${this.money(r.safeSurplusWithoutDestination)}`,
      `Valor mantido na conta principal: ${this.money(r.keptInMainAccount)}`,
      `Saldo final projetado: ${this.money(r.finalBalance)}`,
      `Data de avaliação das realocações: ${this.date(r.projectionDate)}`,
      `CDI diário usado na projeção: ${this.dailyPercent(r.cdiDailyPercentUsed)}`,
      `Dias úteis projetados: ${r.projectionBusinessDays}`,
      '',
      'RESERVA OPERACIONAL',
      `Reserva sugerida: ${this.money(r.suggestedReserve)}`,
      `Explicação: ${r.reserveExplanation ?? ''}`,
      `Histórico: ${this.money(r.historicalPaidAmount)} pagos em ${r.historicalDays} dias; média diária ${this.money(r.historicalDailyExpenseAverage)}; cobertura de ${r.reserveCoverageDays} dias; ${this.date(r.historicalStartDate)} a ${this.date(r.historicalEndDate)}`,
      '',
      'RECOMENDAÇÕES'
    ];

    const recommendations = this.recommendations(r);
    if (!recommendations.length) lines.push('Nenhuma realocação apresentou valor líquido futuro superior a manter o dinheiro na origem até a data final do relatório.');
    recommendations.forEach((x, index) => {
      lines.push(
        `${index + 1}. ${x.sourceAccountName} → ${x.accountName} — ${this.money(x.recommendedAmount)}`,
        `Origem: ${x.sourceDateApplied ? `aplicação de ${this.date(x.sourceDateApplied)}, ${x.sourceAgeDays ?? 0} dias, IR atual ${this.percent(x.sourceIrPercent)}` : `saldo da conta, IR considerado ${this.percent(x.sourceIrPercent)}`}`,
        `Tributos estimados no resgate da origem: ${this.money(x.sourceEstimatedTaxCost)}${x.sourceIofPercent > 0 ? `; IOF atual ${this.percent(x.sourceIofPercent)}` : ''}`,
        `Saldo líquido disponível na origem antes/depois: ${this.money(x.sourceBalanceBefore)} / ${this.money(x.sourceBalanceAfter)}`,
        `Faixa do destino: ${this.range(x)}`,
        `Motivo: ${x.reason}`,
        `Saldo do destino antes/depois: ${this.money(x.destinationBalanceBefore)} / ${this.money(x.destinationBalanceAfter)}`,
        `Limite máximo: ${this.optionalMoney(x.maximumAmount)}; ocupado: ${this.money(x.occupiedAmount)}`,
        `Capacidade antes/depois: ${this.optionalMoney(x.applicationCapacityBefore)} / ${this.optionalMoney(x.applicationCapacityAfter)}`,
        `Faixa antes/depois: ${this.capacity(x.rangeCapacityBefore)} / ${this.capacity(x.rangeCapacityAfter)}`,
        `Rendimento bruto/líquido do destino (${x.destinationYieldIndex}): ${this.percent(x.destinationGrossYield)} / ${this.percent(x.destinationNetYield)}`,
        `Rendimento bruto/líquido da origem (${x.sourceYieldIndex}): ${this.percent(x.sourceGrossYield)} / ${this.percent(x.sourceNetYield)}`,
        `Comparação em ${this.date(x.evaluationDate)}: manter ${this.money(x.projectedKeepValue)} / transferir ${this.money(x.projectedTransferValue)}`,
        `Ganho líquido futuro projetado: ${this.money(x.projectedFutureGain)} (${this.percent(x.projectedFutureGainPercent)})`,
        `IR na data de avaliação: origem ${this.percent(x.sourceIrPercentAtEvaluation)} / novo aporte ${this.percent(x.destinationIrPercentAtEvaluation)}`,
        `Tributação inicial do novo aporte: ${this.tax(x)}`,
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
