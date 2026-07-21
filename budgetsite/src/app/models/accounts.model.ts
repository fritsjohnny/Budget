import { AccountYieldRange } from "./accountyieldrange.model";

export interface Accounts {
  id?: number;
  userId: number;
  name: string;
  color?: string;
  background?: string;
  disabled?: boolean;
  appPackageName?: string;
  calcInGeneral?: boolean;
  position?: number;
  grandTotalBalance?: number | undefined;
  grandTotalYields?: number | undefined;
  totalBalance?: number | undefined;
  currentBalance?: number | undefined;
  currentGrossBalance?: number | undefined;
  totalBalanceGross?: number | undefined;
  previousBalance?: number | undefined;
  totalYields?: number | undefined;
  editing?: boolean;
  deleting?: boolean;
  yieldPercent?: number;
  yieldIndex?: number;
  irPercent?: number;
  isTaxExempt?: boolean;
  lastYield?: number;
  description?: string;
  hasParens?: boolean;
  yieldRanges?: AccountYieldRange[];
}
