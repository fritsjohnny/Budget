export interface InvestmentTargetConfiguration {
  accountId: number;
  yieldIndex: string;
  yieldPercent: number;
  maturityDate?: string | null;
  minimumAmount?: number | null;
  maximumAmount?: number | null;
  availableAmount?: number | null;
  lockedUntilMaturity: boolean;
  postMaturityYieldIndex: string;
  postMaturityYieldPercent?: number | null;
  postMaturityRestartsTaxClock: boolean;
}

export interface InvestmentStrategyReport {
  safeSurplusWithoutDestination: number;
  historicalPaidAmount: number;
  historicalDays: number;
  reserveCoverageDays: number;
  suggestedReserve: number;
  historicalDailyExpenseAverage: number;
  historicalStartDate: string;
  historicalEndDate: string;
  reserveExplanation: string;
  currentBalance: number;
  totalIncome: number;
  totalExpense: number;
  finalBalance: number;
  lowestBalance: number;
  criticalDate?: string | null;
  safeSurplus: number;
  recommendedInvestment: number;
  mainAccountOutflow: number;
  mainAccountInflow: number;
  otherAccountsRecommendedInvestment: number;
  keptInMainAccount: number;
  projectionDate: string;
  cdiDailyPercentUsed?: number | null;
  projectionBusinessDays: number;
  reserve: number;
  classification: string;
  timeline: InvestmentTimeline[] | null;
  recommendations: InvestmentRecommendation[] | null;
  exclusions: InvestmentExclusion[] | null;
  warnings: string[] | null;
  limitations: string[] | null;
}

export interface InvestmentTimeline { date: string; income: number; expense: number; baseBalance: number; strategyBalance: number; reserveMargin: number; isCritical: boolean; }

export interface InvestmentRecommendation {
  sourceAccountId: number; sourceApplicationId?: number | null; sourceAccountName: string; sourceDateApplied?: string | null; sourceAgeDays?: number | null; sourceIrPercent: number; sourceIofPercent: number; sourceEstimatedTaxCost: number; sourceBalanceBefore: number; sourceBalanceAfter: number; isMainAccountSource: boolean; accountId: number; applicationId?: number | null; accountName: string; currentBalance: number; capacity?: number | null; recommendedAmount: number; yieldPercent: number; mainAccountYieldPercent: number; advantagePercent: number; applicationCapacity?: number | null; rangeCapacity?: number | null; rangeStart: number; rangeEnd?: number | null; destinationGrossYield: number; destinationNetYield: number; sourceGrossYield: number; sourceNetYield: number; capacityAfter?: number | null; destinationBalanceBefore: number; destinationBalanceAfter: number; maximumAmount?: number | null; occupiedAmount: number; applicationCapacityBefore?: number | null; applicationCapacityAfter?: number | null; rangeId?: number | null; rangeCapacityBefore?: number | null; rangeCapacityAfter?: number | null; destinationYieldIndex: string; sourceYieldIndex: string; isDestinationTaxExempt: boolean; destinationIrPercent: number; evaluationDate: string; projectedKeepValue: number; projectedTransferValue: number; projectedFutureGain: number; projectedFutureGainPercent: number; sourceIrPercentAtEvaluation: number; destinationIrPercentAtEvaluation: number; capacityBasis: string; reason: string;
}

export interface InvestmentExclusion { accountName: string; reason: string; }
