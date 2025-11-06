export interface AccountsApplications {
  id?: number;
  accountId: number;
  dateApplied: Date;
  amountApplied: number;
  cdiPercent: number | null;
  fixedRate: number | null;
  maturityDate: Date | null;
  createdAt: Date | null;
}
