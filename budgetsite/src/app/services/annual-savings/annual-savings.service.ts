import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiUrls } from 'src/app/common/api-urls';
import { Messenger } from 'src/app/common/messenger';
import { AnnualSavingsConsolidated, AnnualSavingsReport } from 'src/app/models/annual-savings.model';

@Injectable({
  providedIn: 'root'
})
export class AnnualSavingsService {

  constructor(private http: HttpClient, private messenger: Messenger) { }

  getByYear(year: number, includeCurrentMonth: boolean = true, includeNextMonths: boolean = false): Observable<AnnualSavingsReport> {
    return this.http.get<AnnualSavingsReport>(`${ApiUrls.annualSavings}/${year}?includeCurrentMonth=${includeCurrentMonth}&includeNextMonths=${includeNextMonths}`).pipe(
      map(obj => obj),
      catchError(e => this.messenger.errorHandler(e))
    );
  }

  getConsolidated(includeCurrentYear: boolean = true, includeNextYears: boolean = false, includeCurrentMonth: boolean = true, includeNextMonths: boolean = false): Observable<AnnualSavingsConsolidated[]> {
    return this.http.get<AnnualSavingsConsolidated[]>(`${ApiUrls.annualSavings}/consolidated?includeCurrentYear=${includeCurrentYear}&includeNextYears=${includeNextYears}&includeCurrentMonth=${includeCurrentMonth}&includeNextMonths=${includeNextMonths}`).pipe(
      map(obj => obj),
      catchError(e => this.messenger.errorHandler(e))
    );
  }
}
