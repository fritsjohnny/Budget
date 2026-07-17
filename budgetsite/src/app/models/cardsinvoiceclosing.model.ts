export interface CardsInvoiceClosing {
  id: number;
  cardId: number;
  cardName?: string;
  reference: string;
  closingDate: Date;
  isEstimated: boolean;
  isClosed: boolean;
}

export interface UpdateCardsInvoiceClosing {
  closingDate: Date;
}
