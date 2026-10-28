export interface C6StatementTransaction {
  purchaseDate: string | Date;
  cardholderName: string;
  lastFourDigits: string;
  category: string;
  description: string;
  installment: string;
  amountUsd: number;
  exchangeRate: number;
  amountBrl: number;
}

export interface C6StatementPreview {
  fileName: string;
  transactionCount: number;
  purchaseCount: number;
  paymentOrCreditCount: number;
  purchasesTotal: number;
  physicalCards: {
    cardholderName: string;
    lastFourDigits: string;
    transactionCount: number;
  }[];
  transactions: C6StatementTransaction[];
}

export interface CardStatementDescriptionAlias {
  id?: number;
  cardId: number;
  physicalCardId: number;
  statementDescription: string;
  normalizedStatementDescription?: string;
  budgetDescription: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CardStatementReconciliationMatch {
  cardId: number;
  reference: string;
  purchaseDate: string | Date;
  physicalCardId?: number | null;
  lastFourDigits: string;
  normalizedStatementDescription: string;
  installment: string;
  amountBrl: number;
  occurrence: number;
  postingId: number | null;
  isResolved: boolean;
  isIgnored: boolean;
}

export interface CardStatementReconciliationMatchInput {
  cardId: number;
  reference: string;
  purchaseDate: string | Date;
  physicalCardId?: number | null;
  lastFourDigits: string;
  statementDescription: string;
  installment: string;
  amountBrl: number;
  occurrence: number;
  postingId: number | null;
  isResolved: boolean;
  isIgnored: boolean;
}
