import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiUrls } from 'src/app/common/api-urls';
import { Messenger } from 'src/app/common/messenger';
import { AccountYieldRange } from 'src/app/models/accountyieldrange.model';

@Injectable({
  providedIn: 'root'
})
export class AccountYieldRangeService {

  constructor(private http: HttpClient, private messenger: Messenger) { }

  readByAccount(accountId: number): Observable<AccountYieldRange[]> {
    return this.http.get<AccountYieldRange[]>(`${ApiUrls.accountyieldranges}/ByAccount/${accountId}`).pipe(
      map(obj => obj),
      catchError(e => this.messenger.errorHandler(e))
    );
  }

  replaceByAccount(accountId: number, ranges: AccountYieldRange[]): Observable<void> {
    return this.http.put<void>(`${ApiUrls.accountyieldranges}/ByAccount/${accountId}/Replace`, ranges).pipe(
      catchError(e => this.messenger.errorHandler(e))
    );
  }
}