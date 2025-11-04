import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, tap } from 'rxjs';
import { ApiUrls } from 'src/app/common/api-urls';
import { Messenger } from 'src/app/common/messenger';
import { Users } from 'src/app/models/users';
import { UsersAuthenticateRequest } from 'src/app/models/usersauthenticaterequest';
import { UsersAuthenticateResponse } from 'src/app/models/usersauthenticateresponse';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../../environments/environment';
import { switchMap } from 'rxjs/operators';
import { from, of } from 'rxjs';
import { BiometricAuthService } from 'src/app/core/services/biometric-auth.service';


@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(
    private http: HttpClient,
    private messenger: Messenger,
    private router: Router,
    private bio: BiometricAuthService,
  ) { }

  authenticate(
    userAuthenticateRequest: UsersAuthenticateRequest
  ): Observable<UsersAuthenticateResponse> {
    return this.http
      .post<UsersAuthenticateResponse>(
        `${ApiUrls.users}/authenticate`,
        userAuthenticateRequest
      )
      .pipe(
        map((obj) => obj),
        catchError((e) => this.messenger.errorHandler(e))
      );
  }

  loginPage() {
    this.router.navigate(['login']);
  }

  login(userAuthenticateRequest: UsersAuthenticateRequest): Observable<UsersAuthenticateResponse> {
    return this.http
      .post<UsersAuthenticateResponse>(
        `${ApiUrls.users}/authenticate`,
        userAuthenticateRequest
      )
      .pipe(
        // 1) valida resposta e short-circuit se não há token
        tap((res) => {
          if (!res?.token) {
            throw new Error('Falha na autenticação: token ausente.');
          }
        }),
        // 2) salva token em armazenamento SEGURO (SecureStorage)
        switchMap((res) =>
          from(this.bio.saveSessionToken(res.token)).pipe(
            // repassa a resposta adiante
            switchMap(() => of(res))
          )
        ),
        // 3) (opcional) habilita biometria por padrão após 1º login
        //    se preferir um toggle em Configurações, remova esta etapa
        switchMap((res) =>
          from(this.bio.setBiometricEnabled(true)).pipe(
            switchMap(() => of(res))
          )
        ),
        // 4) (opcional) manter user (não sensível) em localStorage
        tap((res) => {
          localStorage.setItem('user', JSON.stringify(res));
        }),
        // 5) (opcional) manter baseUrl em Preferences (não é secreto)
        switchMap((res) =>
          from(
            Preferences.set({ key: 'api_base_url', value: environment.baseUrl })
          ).pipe(switchMap(() => of(res)))
        ),
        // 6) navega para home
        tap(() => this.router.navigate(['']))
      );
  }

  create(user: Users): Observable<Users> {
    return this.http.post<Users>(`${ApiUrls.users}/register`, user).pipe(
      map((obj) => obj),
      catchError((e) => this.messenger.errorHandler(e))
    );
  }

  update(user: Users): Observable<Users> {
    return this.http.put<Users>(`${ApiUrls.users}/${user.id}`, user).pipe(
      map((obj) => obj),
      catchError((e) => this.messenger.errorHandler(e))
    );
  }

  get userToken(): string | null {
    return localStorage.getItem('token') ? localStorage.getItem('token') : null;
  }

  get logged(): boolean {
    return localStorage.getItem('token') !== null;
  }

  async logout(): Promise<void> {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    try { await this.bio.clearSession(); } catch {}
    this.router.navigate(['login']);
  }

  enviarFcmToken(token: string): Observable<any> {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    return this.http
      .post(`${ApiUrls.users}/fcmtoken`, {
        token,
        timezone
      }, {
        headers: { 'Content-Type': 'application/json' }
      })
      .pipe(catchError((e) => this.messenger.errorHandler(e)));
  }

  async getUserTokenAsync(): Promise<string | null> {
    // 1) tenta o localStorage (fluxo legado, rápido)
    const legacy = this.userToken;
    if (legacy) return legacy;

    // 2) tenta o SecureStorage (token salvo pelo login biométrico)
    try {
      const secure = await this.bio.getSessionToken();
      return secure ?? null;
    } catch {
      return null;
    }
  }
}
