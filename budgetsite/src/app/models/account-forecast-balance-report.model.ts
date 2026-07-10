export interface AccountForecastBalanceReport {
  accountId: number;
  accountName: string;
  currentBalance: number;
  finalBalance: number;
  rows: AccountForecastBalanceReportRow[];
}

export interface AccountForecastBalanceReportRow {
  id: number;
  sequence: number;
  date: string;
  description: string;
  amount: number;
  balance: number;
  reference: string;
  type: 'R' | 'P';
}
