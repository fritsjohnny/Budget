import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiUrls } from 'src/app/common/api-urls';
import {
  C6StatementPreview,
  CardStatementDescriptionAlias,
  CardStatementReconciliationMatch,
  CardStatementReconciliationMatchInput,
} from 'src/app/models/cardstatement.model';
import {
  CardsPhysicalCard,
  CardsPhysicalCardInput,
} from 'src/app/models/cardsphysicalcard.model';
import { Messenger } from 'src/app/common/messenger';

@Injectable({ providedIn: 'root' })
export class CardStatementsService {
  constructor(private http: HttpClient, private messenger: Messenger) { }

  previewC6(file: File, cardId: number): Observable<C6StatementPreview> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<C6StatementPreview>(
      `${ApiUrls.cardStatements}/C6/Preview?cardId=${cardId}`,
      formData
    ).pipe(
      map(result => result),
      catchError(error => this.messenger.errorHandler(error))
    );
  }

  readPhysicalCards(cardId: number): Observable<CardsPhysicalCard[]> {
    const params = new HttpParams().set('cardId', String(cardId));

    return this.http.get<CardsPhysicalCard[]>(`${ApiUrls.cardStatements}/PhysicalCards`, { params }).pipe(
      map(result => result ?? []),
      catchError(error => this.messenger.errorHandler(error))
    );
  }

  savePhysicalCards(cardId: number, cards: CardsPhysicalCardInput[]): Observable<CardsPhysicalCard[]> {
    return this.http.put<CardsPhysicalCard[]>(
      `${ApiUrls.cardStatements}/PhysicalCards/${cardId}`,
      cards
    ).pipe(
      map(result => result ?? []),
      catchError(error => this.messenger.errorHandler(error))
    );
  }

  readAliases(cardId: number, physicalCardId: number): Observable<CardStatementDescriptionAlias[]> {
    const params = new HttpParams()
      .set('cardId', String(cardId))
      .set('physicalCardId', String(physicalCardId));

    return this.http.get<CardStatementDescriptionAlias[]>(
      `${ApiUrls.cardStatements}/DescriptionAliases`,
      { params }
    ).pipe(
      map(result => result ?? []),
      catchError(error => this.messenger.errorHandler(error))
    );
  }

  saveAlias(alias: CardStatementDescriptionAlias): Observable<CardStatementDescriptionAlias> {
    return this.http.put<CardStatementDescriptionAlias>(
      `${ApiUrls.cardStatements}/DescriptionAliases`,
      alias
    ).pipe(
      map(result => result),
      catchError(error => this.messenger.errorHandler(error))
    );
  }

  deleteAlias(cardId: number, aliasId: number): Observable<void> {
    const params = new HttpParams().set('cardId', String(cardId));

    return this.http.delete<void>(
      `${ApiUrls.cardStatements}/DescriptionAliases/${aliasId}`,
      { params }
    ).pipe(
      catchError(error => this.messenger.errorHandler(error))
    );
  }

  readReconciliationMatches(cardId: number, reference: string): Observable<CardStatementReconciliationMatch[]> {
    const params = new HttpParams()
      .set('cardId', String(cardId))
      .set('reference', reference);
    return this.http.get<CardStatementReconciliationMatch[]>(
      `${ApiUrls.cardStatements}/ReconciliationMatches`, { params }
    ).pipe(
      map(result => result ?? []),
      catchError(error => this.messenger.errorHandler(error))
    );
  }

  saveReconciliationMatch(input: CardStatementReconciliationMatchInput): Observable<CardStatementReconciliationMatch> {
    return this.http.put<CardStatementReconciliationMatch>(
      `${ApiUrls.cardStatements}/ReconciliationMatches`, input
    ).pipe(
      map(result => result),
      catchError(error => this.messenger.errorHandler(error))
    );
  }

  saveReconciliationMatches(inputs: CardStatementReconciliationMatchInput[]): Observable<CardStatementReconciliationMatch[]> {
    return this.http.put<CardStatementReconciliationMatch[]>(
      `${ApiUrls.cardStatements}/ReconciliationMatches/Batch`, inputs
    ).pipe(
      map(result => result ?? []),
      catchError(error => this.messenger.errorHandler(error))
    );
  }
}
