import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { catchError, from, Observable, switchMap, throwError } from 'rxjs';
import { UserService } from '../user/user.service';
import { environment } from 'src/environments/environment';
import { BiometricAuthService } from 'src/app/core/services/biometric-auth.service';

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  constructor(
    private userService: UserService,
    private bio: BiometricAuthService
  ) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const requestUrl: Array<any> = request.url.split('/');
    const apiUrl: Array<any> = environment.baseUrl.split('/');
    const sameHost = requestUrl[2] === apiUrl[2];

    // 1) tenta token síncrono (legado: localStorage)
    const token = this.userService.userToken;

    if (token && sameHost) {
      const reqWithToken = request.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
      return next.handle(reqWithToken).pipe(
        catchError(err => {
          if (err instanceof HttpErrorResponse && err.status === 401) {
            this.userService.logout();
          }
          return throwError(err);
        })
      );
    }

    // 2) fallback: busca no SecureStorage de forma assíncrona
    return from(this.userService.getUserTokenAsync()).pipe(
      switchMap(asyncToken => {
        const finalReq = (asyncToken && sameHost)
          ? request.clone({ setHeaders: { Authorization: `Bearer ${asyncToken}` } })
          : request;
        return next.handle(finalReq);
      }),
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          this.userService.logout();
        }
        return throwError(err);
      })
    );
  }
}
