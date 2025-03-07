import { Cards } from './cards.model';
import { Categories } from "./categories.model";
import { People } from "./people.model";

export interface CardsPostings {
  id?: number;
  cardId: number;
  date: Date;
  reference: string;
  position?: number;
  description: string;
  peopleId?: string;
  parcelNumber?: number;
  parcels?: number;
  amount: number;
  totalAmount?: number;
  others: boolean;
  note?: string;
  people?: People;
  card?: Cards;
  categoryId?: number;
  peopleList?: People[];
  categoriesList?: Categories[];
  cardsList?: Cards[];
  adding?: boolean;
  editing?: boolean;
  deleting?: boolean;
  isSelected?: boolean;
  generateParcels?: boolean;
  inTheCycle?: boolean;
  repeatParcels?: boolean;
  monthsToRepeat?: number;
  payWithCard?: boolean;
  fixed?: boolean;
}
