export interface AccountsYieldsDto {
  accountId: number;
  account: string;
  color: string;
  background: string;
  date: string | Date;
  reference: string;
  amount: number;
  runningTotal: number;
  dayTotal: number;
}
