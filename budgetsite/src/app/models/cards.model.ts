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
  expenseDueDate?: Date;
  editing?: boolean,
  deleting?: boolean;
}
