import { Categories } from './categories.model';
import { Cards } from "./cards.model";
import { People } from './people.model';

export interface Expenses {
  id?: number;
  userId: number;
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
  peopleId?: string;
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
}
