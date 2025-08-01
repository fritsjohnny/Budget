import { Accounts } from "./accounts.model";
import { Cards } from "./cards.model";
import { People } from "./people.model";

export interface Incomes {
  id?: number;
  userId: number;
  reference: string;
  position?: number;
  description: string;
  toReceive: number;
  received: number;
  remaining: number;
  note?: string;
  card?: Cards;
  cardId?: number;
  accountId?: number;
  type?: string;
  peopleId?: number;
  adding?: boolean;
  editing?: boolean;
  deleting?: boolean;
  cardsList?: Cards[];
  accountsList?: Accounts[];
  peopleList?: People[];
  typesList?: [];
  repeatIncome?: boolean;
  monthsToRepeat?: number;
  relatedId?: number;
}
