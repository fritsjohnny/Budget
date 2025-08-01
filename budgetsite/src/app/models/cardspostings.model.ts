import { Cards } from './cards.model';
import { Categories } from "./categories.model";
import { Expenses } from './expenses.model';
import { People } from "./people.model";

export interface CardsPostings {
  id?: number;
  cardId: number;
  date: Date;
  reference: string;
  position?: number;
  description: string;
  peopleId?: number;
  parcelNumber?: number;
  parcels?: number;
  amount: number;
  totalAmount?: number;
  others: boolean;
  note?: string;
  people?: People;
  card?: Cards;
  categoryId?: number;
  category: string;
  peopleList?: People[];
  categoriesList?: Categories[];
  cardsList?: Cards[];
  adding?: boolean;
  editing?: boolean;
  deleting?: boolean;
  isSelected?: boolean;
  generateParcels?: boolean;
  repeatParcels?: boolean;
  monthsToRepeat?: number;
  payWithCard?: boolean;
  fixed?: boolean;
  relatedId?: number;
  repeatToNextMonths?: boolean;
  dueDate?: Date;
  isPaid?: boolean;
  overdue?: boolean;
  duetoday?: boolean;
  expenseId?: number;
  expensesList?: Expenses[];
}
