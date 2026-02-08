import { Categories } from './categories.model';
import { Cards } from "./cards.model";
import { People } from './people.model';

export interface Expenses {
  id?: number;
  userId?: number;
  reference: string;
  position?: number;
  description: string;
  toPay: number;
  totalToPay: number;
  paid: number;
  remaining: number;
  note?: string;
  cardId?: number;
  dueDate?: Date;
  parcelNumber?: number;
  parcels?: number;
  categoryId?: number;
  category?: string;
  scheduled?: boolean;
  peopleId?: number;
  adding?: boolean;
  editing?: boolean;
  deleting?: boolean;
  generateParcels?: boolean;
  repeatParcels?: boolean;
  monthsToRepeat?: number;
  card?: Cards;
  cardsList?: Cards[];
  categoriesList?: Categories[];
  peopleList?: People[];
  overdue?: boolean;
  duetoday?: boolean;
  fixed?: boolean;
  relatedId?: number;
  dueDay?: number;
  expectedValue?: number;
}

export interface ExpensesDueDateReportRow {
  id: number;
  dueDate?: string;
  reference?: string;
  description?: string;
  toPay: number;
  paid: number;
  remaining: number;
  categoryId?: number;
  categoryName?: string;
  peopleId?: number;
}