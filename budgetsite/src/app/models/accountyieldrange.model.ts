export interface AccountYieldRange {
  id?: number;
  accountId: number;
  startAmount: number;
  endAmount?: number | null;
  yieldPercent: number;
  position: number;
}
