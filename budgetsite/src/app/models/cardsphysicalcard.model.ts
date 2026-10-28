export interface CardsPhysicalCard {
  id?: number;
  cardId: number;
  nameOnCard: string;
  lastFourDigits: string;
  isActive: boolean;
}

export interface CardsPhysicalCardInput {
  id?: number;
  nameOnCard: string;
  lastFourDigits: string;
}
