import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiUrls } from 'src/app/common/api-urls';
import { CardsPostings } from 'src/app/models/cardspostings.model';
import { catchError, map } from 'rxjs/operators';
import { Messenger } from 'src/app/common/messenger';
import { CardsPostingsDTO } from 'src/app/models/cardspostingsdto.model';
import { Expenses } from 'src/app/models/expenses.model';

@Injectable({
  providedIn: 'root',
})
export class CardPostingsService {
  constructor(private http: HttpClient, private messenger: Messenger) { }

  create(cardPosting: CardsPostings): Observable<CardsPostings> {
    cardPosting.others = cardPosting.peopleId ? true : false;

    const parcels = cardPosting.generateParcels || cardPosting.repeatParcels;
    let params = new HttpParams().set('allowClosedInvoiceOperation', String(cardPosting.allowClosedInvoiceOperation ?? false));
    if (parcels) params = params.set('repeat', String(cardPosting.repeatParcels ?? false)).set('qtyMonths', String(cardPosting.monthsToRepeat ?? 0));
    return this.http
      .post<CardsPostings>(`${ApiUrls.cardspostings}${parcels ? '/allparcels' : ''}`, cardPosting, { params })
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  read(cardId: number, reference: string): Observable<CardsPostings[]> {
    return this.http
      .get<CardsPostings[]>(`${ApiUrls.cardspostings}/${cardId}/${reference}`)
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  readById(id?: number): Observable<CardsPostings> {
    return this.http
      .get<CardsPostings>(`${ApiUrls.cardspostings}/${id}`)
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  readCardsPostingsByPeople(
    peopleId: number,
    reference?: string
  ): Observable<CardsPostings[]> {
    return this.http
      .get<CardsPostings[]>(
        `${ApiUrls.cardspostings}/people/${peopleId}/${reference}`
      )
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  readCardsPostingsPeople(
    cardId?: number,
    reference?: string
  ): Observable<CardsPostingsDTO[]> {
    return this.http
      .get<CardsPostingsDTO[]>(
        `${ApiUrls.cardspostingspeople}cardId=${cardId}&reference=${reference}`
      )
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  readByPeopleId(
    peopleId?: number,
    reference?: string,
    cardId?: number
  ): Observable<CardsPostingsDTO> {
    return this.http
      .get<CardsPostingsDTO>(
        `${ApiUrls.cardspostings}/PeopleById?peopleId=${peopleId}&reference=${reference}&cardId=${cardId}`
      )
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  readByReferences(
    initialReference: string,
    finallReference: string,
    categoryId: number = 0,
    others: boolean = false
  ): Observable<CardsPostings[]> {
    const url = `${ApiUrls.cardspostings}/references?InitialReference=${initialReference}&FinalReference=${finallReference}&CategoryId=${categoryId}&Others=${others}`;

    return this.http.get<CardsPostings[]>(url).pipe(
      map((obj) => obj),
      catchError((e) => this.messenger.errorHandler(e))
    );
  }

  update(cardPosting: CardsPostings): Observable<CardsPostings> {
    cardPosting.others = cardPosting.peopleId
      ? true
      : false;

    const hasParcelOperation =
      cardPosting.generateParcels ||
      cardPosting.repeatParcels;

    const params: string[] = [];
    params.push(`allowClosedInvoiceOperation=${cardPosting.allowClosedInvoiceOperation ?? false}`);

    if (hasParcelOperation) {
      params.push(
        `repeat=${cardPosting.repeatParcels ?? false}`
      );

      params.push(
        `qtyMonths=${cardPosting.monthsToRepeat ?? 0}`
      );
    } else if (cardPosting.repeatToNextMonths) {
      params.push(
        `repeatToNextMonths=${cardPosting.repeatToNextMonths ?? false}`
      );

      params.push(
        `preserveFutureValues=${cardPosting.preserveFutureValues ?? false}`
      );
    }

    const query =
      params.length > 0
        ? `?${params.join('&')}`
        : '';

    const route = hasParcelOperation
      ? '/allparcels'
      : '';

    return this.http
      .put<CardsPostings>(
        `${ApiUrls.cardspostings}${route}/${cardPosting.id}${query}`,
        cardPosting
      )
      .pipe(
        map((obj) => obj),
        catchError((e) =>
          this.messenger.errorHandler(e)
        )
      );
  }


  updatePositions(cardPostings: CardsPostings[]): Observable<CardsPostings> {
    return this.http
      .put<any>(`${ApiUrls.cardspostings}/setpositions`, cardPostings)
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  reorderByDate(cardId: number, reference: string): Observable<void> {
    return this.http
      .put<void>(
        `${ApiUrls.cardspostings}/ReorderByDate/${cardId}/${reference}`,
        null
      )
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  delete(cardPosting: CardsPostings, allowClosedInvoiceOperation?: boolean): Observable<CardsPostings> {
    const params = new HttpParams().set(
      'allowClosedInvoiceOperation',
      String(allowClosedInvoiceOperation ?? cardPosting.allowClosedInvoiceOperation ?? false)
    );
    return this.http
      .delete<CardsPostings>(
        `${ApiUrls.cardspostings}/${cardPosting.id}`,
        { params }
      )
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  convertToExpense(
    cardPosting: CardsPostings,
    allowClosedInvoiceOperation: boolean = false
  ): Observable<Expenses> {
    const params = new HttpParams().set(
      'allowClosedInvoiceOperation',
      String(allowClosedInvoiceOperation)
    );

    return this.http.post<Expenses>(
      `${ApiUrls.cardspostings}/${cardPosting.id}/ConvertToExpense`,
      null,
      { params }
    ).pipe(
      map((obj) => obj),
      catchError((e) => this.messenger.errorHandler(e))
    );
  }

  createFromNotification(cardPosting: CardsPostings): Observable<CardsPostings> {
    cardPosting.others = cardPosting.peopleId ? true : false;

    const useParcels = cardPosting.generateParcels || cardPosting.repeatParcels;

    let params = new HttpParams().set('allowClosedInvoiceOperation', String(cardPosting.allowClosedInvoiceOperation ?? false));
    if (useParcels) params = params.set('repeat', String(cardPosting.repeatParcels ?? false)).set('qtyMonths', String(cardPosting.monthsToRepeat ?? 0));
    const url = `${ApiUrls.cardspostings}/FromNotification${useParcels ? '/AllParcels' : ''}`;

    return this.http.post<CardsPostings>(url, cardPosting, { params }).pipe(
      map((obj) => obj),
      catchError((e) => this.messenger.errorHandler(e))
    );
  }

  getCategoryByDescription(description: string): Observable<any> {
    return this.http
      .get<any>(`${ApiUrls.cardspostings}/ByDescription`, { params: { description } })
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }
}
