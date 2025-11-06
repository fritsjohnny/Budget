import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiUrls } from 'src/app/common/api-urls'
import { catchError, map } from 'rxjs/operators';
import { Messenger } from 'src/app/common/messenger';
import { AccountsApplications } from 'src/app/models/accountsapplications.model';

@Injectable({
  providedIn: 'root'
})
export class AccountApplicationsService {

  constructor(private http: HttpClient, private messenger: Messenger) { }

  create(accountapplication: AccountsApplications): Observable<AccountsApplications> {
    return this.http.post<AccountsApplications>(ApiUrls.accountsapplications, accountapplication).pipe(
      map(obj => obj),
      catchError(e => this.messenger.errorHandler(e))
    );
  }

  read(): Observable<AccountsApplications[]> {

    return this.http.get<AccountsApplications[]>(ApiUrls.accountsapplications).pipe(
      map(obj => obj),
      catchError(e => this.messenger.errorHandler(e))
    );
  }

  readByAccount(accountId: number): Observable<AccountsApplications[]> {
    return this.http.get<AccountsApplications[]>(`${ApiUrls.accountsapplications}/ByAccount/${accountId}`).pipe(
      map(obj => obj),
      catchError(e => this.messenger.errorHandler(e))
    );
  }

  update(accountApplication: AccountsApplications): Observable<AccountsApplications> {
    return this.http.put<AccountsApplications>(`${ApiUrls.accountsapplications}/${accountApplication.id}`, accountApplication).pipe(
      map(obj => obj),
      catchError(e => this.messenger.errorHandler(e))
    );
  }

  delete(id: number): Observable<AccountsApplications> {
    return this.http.delete<AccountsApplications>(`${ApiUrls.accountsapplications}/${id}`).pipe(
      map(obj => obj),
      catchError(e => this.messenger.errorHandler(e))
    );
  }
}
