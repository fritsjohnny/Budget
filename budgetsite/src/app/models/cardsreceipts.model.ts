import { Accounts } from "./accounts.model";
import { Cards } from "./cards.model";

export interface CardsReceipts {
  id?: number;
  reference: string;
  date: Date;
  cardId: number;
  peopleId: number;
  accountId: number;
  amount?: number;
  change?: number;
  note?: string;
  toReceive?: number;
  received?: number;
  remaining?: number;
  accountsList?: Accounts[];
  card?: Cards;
}

export interface CardReceiptMovement {
  id: number;
  reference: string;
  date: Date | string;
  cardId: number;
  cardName?: string;
  cardBackground?: string;
  cardColor?: string;
  peopleId?: number;
  peopleName?: string;
  accountId: number;
  accountName?: string;
  amount: number;
  note?: string;
}
