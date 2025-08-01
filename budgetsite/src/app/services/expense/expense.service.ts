import { ExpensesByCategories } from './../../models/expensesbycategories';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiUrls } from 'src/app/common/api-urls';
import { catchError, map } from 'rxjs/operators';
import { Messenger } from 'src/app/common/messenger';
import { Expenses } from 'src/app/models/expenses.model';

@Injectable({
  providedIn: 'root',
})
export class ExpenseService {
  constructor(private http: HttpClient, private messenger: Messenger) { }

  create(expense: Expenses): Observable<Expenses> {
    return this.http
      .post<Expenses>(
        `${ApiUrls.expenses}${expense.generateParcels || expense.repeatParcels
          ? `/allparcels?repeat=${expense.repeatParcels ?? false}&qtyMonths=${expense.monthsToRepeat ?? 0
          }`
          : ''
        }`,
        expense
      )
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  read(reference: string, justMyValues: boolean): Observable<Expenses[]> {
    const url = `${ApiUrls.expenses}/reference${justMyValues ? '2' : ''
      }/${reference}`;

    return this.http.get<Expenses[]>(url).pipe(
      map((obj) => obj),
      catchError((e) => this.messenger.errorHandler(e))
    );
  }

  readById(id?: number): Observable<Expenses> {
    const url = `${ApiUrls.expenses}/${id}`;

    return this.http.get<Expenses>(url).pipe(
      map((obj) => obj),
      catchError((e) => this.messenger.errorHandler(e))
    );
  }

  readComboList(reference: string): Observable<Expenses[]> {
    return this.http
      .get<Expenses[]>(`${ApiUrls.expenses}/combolist/${reference}`)
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  readByCategories(
    reference: string,
    cardId: number
  ): Observable<ExpensesByCategories[]> {
    return this.http
      .get<ExpensesByCategories[]>(
        `${ApiUrls.expenses}/categories?reference=${reference}&cardId=${cardId}`
      )
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  readByCategory(ec: ExpensesByCategories): Observable<ExpensesByCategories> {
    return this.http
      .get<ExpensesByCategories>(
        `${ApiUrls.expenses}/CategoriesById?Id=${ec.id}&Reference=${ec.reference}&CardId=${ec.cardId}`
      )
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  readByReferences(
    initialReference: string,
    finallReference: string
  ): Observable<Expenses[]> {
    const url = `${ApiUrls.expenses}/references?InitialReference=${initialReference}&FinalReference=${finallReference}`;

    return this.http.get<Expenses[]>(url).pipe(
      map((obj) => obj),
      catchError((e) => this.messenger.errorHandler(e))
    );
  }

  update(expense: Expenses): Observable<Expenses> {
    return this.http
      .put<Expenses>(
        `${ApiUrls.expenses}${expense.generateParcels || expense.repeatParcels ? '/allparcels' : ''
        }/${expense.id}${expense.generateParcels || expense.repeatParcels
          ? `?repeat=${expense.repeatParcels ?? false}&qtyMonths=${expense.monthsToRepeat ?? 0
          }`
          : ''
        }`,
        expense
      )
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  updateValue(id: number, value: number): Observable<Expenses> {
    return this.http
      .put<Expenses>(`${ApiUrls.expenses}/AddValue/${id}?value=${value}`, null)
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  delete(id: number): Observable<Expenses> {
    return this.http.delete<Expenses>(`${ApiUrls.expenses}/${id}`).pipe(
      map((obj) => obj),
      catchError((e) => this.messenger.errorHandler(e))
    );
  }

  getCategoryByDescription(description: string): Observable<any> {
    return this.http
      .get<any>(`${ApiUrls.expenses}/ByDescription/${description}`)
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  orderByPreviousMonth(reference: string): Observable<any> {
    return this.http
      .post<any>(
        `${ApiUrls.expenses}/OrderByPreviousMonth?Reference=${reference}`,
        null
      )
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  getUpcomingOrOverdueExpenses(daysAhead: number = 1): Observable<Expenses[]> {
    return this.http
      .get<Expenses[]>(`${ApiUrls.expenses}/Notify?daysAhead=${daysAhead}`)
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  public ajustarPorCategoria(id: number): Observable<any> {
    return this.http.post(`${ApiUrls.expenses}/AjustarPorCategoria/${id}`, null);
  }
}
