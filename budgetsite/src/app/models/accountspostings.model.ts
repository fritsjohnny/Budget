import { Accounts } from "./accounts.model";
import { CardsReceipts } from "./cardsreceipts.model";
import { Expenses } from "./expenses.model";
import { Incomes } from "./incomes.model";

export interface AccountsPostingApplicationDetail {
  id?: number;
  accountPostingId?: number;
  accountApplicationId: number;
  amount: number;
  grossAmount?: number | null;
  totalGrossBalance?: number | null;
  totalBalance?: number | null;
  totalIOF?: number | null;
  totalIR?: number | null;
  iofElapsedDays?: number | null;
  createdAt?: Date;
}

export interface AccountsPostings {
  id?: number;
  accountId: number;
  date: Date;
  reference: string;
  position?: number;
  description: string;
  amount: number;
  remaining: number;
  runningAmount: number;
  note: string | null;
  type?: string;
  cardReceiptId?: number;
  expenseId?: number;
  incomeId?: number;
  accountsList?: Accounts[];
  incomesList?: Incomes[];
  expensesList?: Expenses[];
  editing?: boolean;
  deleting?: boolean;
  account?: Accounts;
  cardReceipt?: CardsReceipts;
  totalBalance: number;
  currentBalanceForYield?: number;
  currentGrossBalanceForYield?: number;
  totalGrossBalance: number;
  totalYields: number | null;
  lastYield: number;
  grossAmount: number | null;
  originalAmount: number | null;
  originalGrossAmount: number | null;
  algorithmType?: string;
  totalIOF?: number;
  totalIR?: number;
  accountPostingsYields?: AccountsPostings[];
  iofElapsedDays?: number;
  iofElapsedDate?: Date;
  relatedId?: number;
  toAccountId?: number;
  totalPreviousYield?: number;
  applicationDetails?: AccountsPostingApplicationDetail[];
}
