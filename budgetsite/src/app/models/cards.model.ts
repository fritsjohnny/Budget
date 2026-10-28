export interface Cards {
  id?: number;
  userId?: number;
  name: string;
  color?: string;
  background?: string;
  disabled?: boolean;
  closingDay?: number;
  dueDay?: number;
  appPackageName?: string;
  statementProvider?: string | null;
  statementPassword?: string | null;
  clearStatementPassword?: boolean;
  hasStatementPassword?: boolean;
  expenseDueDate?: Date;
  editing?: boolean,
  deleting?: boolean;
}
