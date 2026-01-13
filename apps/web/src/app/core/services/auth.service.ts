import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, map, Observable, throwError, tap } from 'rxjs';
import { API_BASE_URL } from '../tokens';
import { I18nService } from '../i18n/i18n.service';

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface AuthTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
}

export interface NewPasswordChallenge {
  challenge: 'NEW_PASSWORD_REQUIRED';
  session: string;
  message: string;
}

export type LoginResponse = AuthTokens | NewPasswordChallenge;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly baseUrl = inject(API_BASE_URL);

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(this.buildUrl('/login'), { email, password })
      .pipe(
        map((response) => this.localizeChallenge(response)),
        catchError((error) => this.handleError(error, 'login'))
      );
  }

  refreshTokens(refreshToken: string): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(this.buildUrl('/refresh'), { refreshToken })
      .pipe(
        tap((tokens) => this.persistTokens(tokens)),
        catchError((error) => this.handleError(error, 'login'))
      );
  }

  clearSession() {
    localStorage.removeItem('pettzi.idToken');
    localStorage.removeItem('pettzi.accessToken');
    localStorage.removeItem('pettzi.refreshToken');
    localStorage.removeItem('pettzi.accessTokenExpiresAt');
  }

  register(email: string, password: string): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(this.buildUrl('/register'), { email, password })
      .pipe(catchError((error) => this.handleError(error, 'register')));
  }

  private buildUrl(path: string) {
    const base = this.baseUrl || '';
    const authBase = this.resolveAuthBase(base);
    return `${authBase}${path}`;
  }

  private handleError(error: HttpErrorResponse, flow: 'login' | 'register') {
    const payload = (error.error as ApiErrorBody) ?? {};
    const message = payload?.error?.message ?? '';
    const t = (key: string) => this.i18n.t(key);

    if (error.status === 0) {
      return throwError(() => new Error(t('errors.network')));
    }

    if (flow === 'login') {
      if (message === 'Invalid email or password') {
        return throwError(() => new Error(t('errors.loginInvalid')));
      }
      if (message === 'User is not confirmed') {
        return throwError(() => new Error(t('errors.loginUnconfirmed')));
      }
      return throwError(() => new Error(t('errors.loginDefault')));
    }

    if (flow === 'register') {
      if (error.status === 409) {
        return throwError(() => new Error(t('errors.registerConflict')));
      }
      if (error.status === 400) {
        return throwError(() => new Error(t('errors.registerInvalid')));
      }
      return throwError(() => new Error(t('errors.registerDefault')));
    }

    return throwError(() => new Error(t('errors.network')));
  }

  private localizeChallenge(response: LoginResponse): LoginResponse {
    if (!('challenge' in response)) {
      return response;
    }

    return { ...response, message: this.i18n.t('errors.loginChallenge') };
  }

  private persistTokens(tokens: AuthTokens) {
    localStorage.setItem('pettzi.idToken', tokens.idToken);
    localStorage.setItem('pettzi.accessToken', tokens.accessToken);
    if (tokens.refreshToken) {
      localStorage.setItem('pettzi.refreshToken', tokens.refreshToken);
    }
  }

  private resolveAuthBase(baseUrl: string) {
    if (!baseUrl) {
      return '/auth';
    }

    if (baseUrl.includes('execute-api')) {
      return baseUrl.replace(/\/$/, '');
    }

    if (baseUrl.endsWith('/auth')) {
      return baseUrl;
    }

    return `${baseUrl}/auth`;
  }
}
