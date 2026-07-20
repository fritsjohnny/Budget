import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiUrls } from 'src/app/common/api-urls';
import { Messenger } from 'src/app/common/messenger';
import { CardsInvoiceClosing } from 'src/app/models/cardsinvoiceclosing.model';

@Injectable({ providedIn: 'root' })
export class CardsInvoiceClosingService {
  constructor(private http: HttpClient, private messenger: Messenger) {}

  ensure(cardId: number, reference: string): Observable<CardsInvoiceClosing> {
    return this.http.post<CardsInvoiceClosing>(
      `${ApiUrls.cardsInvoiceClosings}/Ensure/${cardId}/${reference}`,
      null
    ).pipe(
      map(value => value),
      catchError(error => this.messenger.errorHandler(error))
    );
  }

  preparePosting(cardId: number, reference: string): Observable<CardsInvoiceClosing> {
    return this.http.post<CardsInvoiceClosing>(
      `${ApiUrls.cardsInvoiceClosings}/PreparePosting/${cardId}/${reference}`,
      null
    ).pipe(
      map(value => value),
      catchError(error => this.messenger.errorHandler(error))
    );
  }

  update(id: number, closingDate: Date): Observable<CardsInvoiceClosing> {
    return this.http.put<CardsInvoiceClosing>(
      `${ApiUrls.cardsInvoiceClosings}/${id}`,
      { closingDate }
    ).pipe(
      map(value => value),
      catchError(error => this.messenger.errorHandler(error))
    );
  }
}
