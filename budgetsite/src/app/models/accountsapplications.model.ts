import { Accounts } from "./accounts.model";

export interface AccountsApplications {
  id?: number;
  accountId: number;
  dateApplied: Date;
  amountApplied: number;
  maximumAmount: number | null;
  disabled?: boolean;
  cdiPercent: number | null;
  fixedRate: number | null;
  maturityDate: Date | null;
  createdAt: Date | null;
  editing?: boolean;
  deleting?: boolean;
  accountsList?: Accounts[];
}
