import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiUrls } from 'src/app/common/api-urls';
import { Messenger } from 'src/app/common/messenger';
import { FinancialHealthReport } from 'src/app/models/financial-health-report.model';

@Injectable({
  providedIn: 'root'
})
export class FinancialHealthService {
  constructor(
    private http: HttpClient,
    private messenger: Messenger
  ) { }

  getReport(
    initialReference: string,
    finalReference: string,
    reserveTargetMonths: number,
    futureMonths: number,
    includeCurrentMonth: boolean
  ): Observable<FinancialHealthReport> {
    const params = new HttpParams()
      .set('initialReference', initialReference)
      .set('finalReference', finalReference)
      .set('reserveTargetMonths', reserveTargetMonths.toString())
      .set('futureMonths', futureMonths.toString())
      .set('includeCurrentMonth', includeCurrentMonth.toString());

    return this.http
      .get<FinancialHealthReport>(ApiUrls.financialHealth, { params })
      .pipe(
        map(report => report),
        catchError(error => this.messenger.errorHandler(error))
      );
  }
}
