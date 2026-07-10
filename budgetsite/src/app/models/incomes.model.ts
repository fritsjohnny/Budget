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
  parcelNumber?: number;
  parcels?: number;
  totalToReceive?: number;
  receiptDate?: Date;
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
  generateParcels?: boolean;
  repeatIncome?: boolean;
  monthsToRepeat?: number;
  repeatToNextMonths?: boolean;
  preserveFutureValues?: boolean;
  relatedId?: number;
}
