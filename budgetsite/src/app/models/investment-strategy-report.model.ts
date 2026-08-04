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
  keptInMainAccount: number;
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
  accountId: number; applicationId?: number | null; accountName: string; currentBalance: number; capacity?: number | null; recommendedAmount: number; yieldPercent: number; mainAccountYieldPercent: number; advantagePercent: number; applicationCapacity?: number | null; rangeCapacity?: number | null; rangeStart: number; rangeEnd?: number | null; destinationGrossYield: number; destinationNetYield: number; sourceGrossYield: number; sourceNetYield: number; capacityAfter?: number | null; destinationBalanceBefore: number; destinationBalanceAfter: number; maximumAmount?: number | null; occupiedAmount: number; applicationCapacityBefore?: number | null; applicationCapacityAfter?: number | null; rangeId?: number | null; rangeCapacityBefore?: number | null; rangeCapacityAfter?: number | null; destinationYieldIndex: string; sourceYieldIndex: string; isDestinationTaxExempt: boolean; destinationIrPercent: number; capacityBasis: string; reason: string;
}

export interface InvestmentExclusion { accountName: string; reason: string; }
