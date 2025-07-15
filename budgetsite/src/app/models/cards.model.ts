import { CardsInvoiceDate } from "./cardsinvoiceDate.model";

export interface Cards {
  id?: number;
  userId: number;
  name: string;
  color?: string;
  background?: string;
  disabled?: boolean;
  closingDay?: number;
  dueDay?: number;
  appPackageName?: string;
  editing?: boolean,
  deleting?: boolean;
  cardInvoiceDate?: CardsInvoiceDate;
}
