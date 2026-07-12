export interface FinancialHealthReport {
  initialReference: string;
  finalReference: string;
  effectiveFinalReference: string;
  periodMonths: number;
  includeCurrentMonth: boolean;
  futureMonths: number;
  generatedAt: string;
  score: number;
  classification: string;
  executiveSummary: string;
  summary: FinancialHealthSummary;
  comparison: FinancialHealthComparison;
  monthlyEvolution: FinancialHealthMonthly[];
  accounts: FinancialHealthAccount[];
  institutions: FinancialHealthInstitution[];
  categories: FinancialHealthCategory[];
  futureProjection: FinancialHealthFutureProjection[];
  futureInstallmentCategories: FinancialHealthInstallmentCategory[];
  dataQuality: FinancialHealthDataQuality;
  insights: FinancialHealthInsight[];
  scoreComponents: FinancialHealthScoreComponent[];
  legends: FinancialHealthLegend[];
}

export interface FinancialHealthSummary {
  totalIncome: number;
  totalExpenses: number;
  totalYields: number;
  totalSurplus: number;
  surplusWithoutYields: number;
  averageIncome: number;
  averageExpenses: number;
  averageSurplus: number;
  medianIncome: number;
  medianExpenses: number;
  medianSurplus: number;
  savingsRate: number;
  savingsRateWithoutYields: number;
  yieldShareOfIncome: number;
  yieldShareOfSurplus: number;
  normalizedAverageIncome: number;
  normalizedAverageExpenses: number;
  normalizedAverageSurplus: number;
  normalizedSavingsRate: number;
  normalizedMonths: number;
  positiveMonths: number;
  negativeMonths: number;
  neutralMonths: number;
  netCashChange: number;
  liquidBalance: number;
  grossBalance: number;
  grossDifference: number;
  averageFixedCommitments: number;
  reserveCoverageMonths: number;
  reserveTargetMonths: number;
  reserveTargetValue: number;
  reserveGap: number;
  futureInstallments: number;
  installmentPressurePercent: number;
  topInstitutionName: string;
  topInstitutionShare: number;
  topCategoryName: string;
  topCategoryShare: number;
}

export interface FinancialHealthComparison {
  hasPreviousData: boolean;
  previousInitialReference: string;
  previousFinalReference: string;
  previousAverageIncome: number;
  previousAverageExpenses: number;
  previousAverageSurplus: number;
  previousSavingsRate: number;
  incomeChangePercent: number | null;
  expensesChangePercent: number | null;
  surplusChangePercent: number | null;
  savingsRateChangePoints: number;
}

export interface FinancialHealthMonthly {
  reference: string;
  label: string;
  income: number;
  expenses: number;
  yields: number;
  surplus: number;
  surplusWithoutYields: number;
  savingsRate: number;
  netCashChange: number;
  fixedCommitments: number;
  closingBalance: number;
  isIncomeOutlier: boolean;
  isExpenseOutlier: boolean;
  isOutlier: boolean;
}

export interface FinancialHealthAccount {
  id: number;
  name: string;
  institution: string;
  balance: number;
  grossBalance: number;
  grossDifference: number;
  share: number;
  yieldPercent: number | null;
  yieldIndex: string;
  maturityDate: string | null;
}

export interface FinancialHealthInstitution {
  name: string;
  balance: number;
  share: number;
  accounts: number;
}

export interface FinancialHealthCategory {
  categoryId: number | null;
  name: string;
  amount: number;
  previousAmount: number;
  changeAmount: number;
  changePercent: number | null;
  average: number;
  share: number;
}

export interface FinancialHealthFutureProjection {
  reference: string;
  label: string;
  income: number;
  expenses: number;
  surplus: number;
  cardInstallments: number;
  directInstallments: number;
  totalInstallments: number;
  isPossiblyIncomplete: boolean;
}

export interface FinancialHealthInstallmentCategory {
  name: string;
  amount: number;
  share: number;
}

export interface FinancialHealthDataQuality {
  potentialDuplicateGroups: number;
  potentialDuplicateRows: number;
  potentialDuplicateAmount: number;
  expensesWithoutCategory: number;
  cardPostingsWithoutCategory: number;
  expensesWithoutDueDate: number;
  incomesWithoutReceiptDate: number;
  futureMonthsPossiblyIncomplete: number;
  potentialDuplicates: FinancialHealthPotentialDuplicate[];
}

export interface FinancialHealthPotentialDuplicate {
  source: string;
  reference: string;
  description: string;
  date: string | null;
  amount: number;
  count: number;
  extraRows: number;
  extraAmount: number;
}

export interface FinancialHealthInsight {
  section: string;
  severity: 'success' | 'info' | 'warning' | 'danger';
  icon: string;
  title: string;
  text: string;
  priority: number;
}

export interface FinancialHealthScoreComponent {
  name: string;
  weight: number;
  score: number;
  weightedScore: number;
  explanation: string;
}

export interface FinancialHealthLegend {
  title: string;
  text: string;
}
