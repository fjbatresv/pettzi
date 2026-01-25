import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { catchError, map, Observable, throwError, tap, from, switchMap } from 'rxjs';
import { API_BASE_URL } from '../tokens';
import { I18nService } from '../i18n/i18n.service';
import { TokenStorageService } from './token-storage.service';
import { environment } from '../../../environments/environment';

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

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  fullName?: string;
  profilePhotoKey?: string;
  locale?: 'es' | 'en';
}

export interface UserSettings {
  theme: 'light' | 'dark';
  weightUnit: 'kg' | 'lb';
  distanceUnit: 'm' | 'in';
  newsletter: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly storage = inject(TokenStorageService);

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(this.buildUrl('/login'), { email, password }, { withCredentials: true })
      .pipe(
        map((response) => this.localizeChallenge(response)),
        catchError((error) => this.handleError(error, 'login'))
      );
  }

  refreshTokens(): Observable<AuthTokens> {
    return from(this.storage.getRefreshToken()).pipe(
      switchMap((refreshToken) =>
        this.http.post<AuthTokens>(
          this.buildUrl('/refresh'),
          refreshToken ? { refreshToken } : {},
          { withCredentials: true }
        )
      ),
      tap((tokens) => this.storeTokens(tokens)),
      catchError((error) => this.handleError(error, 'login'))
    );
  }

  clearSession() {
    this.storage.clear();
  }

  register(
    name: string,
    email: string,
    password: string,
    locale: 'es' | 'en'
  ): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(
        this.buildUrl('/register'),
        { name, email, password, locale },
        { withCredentials: true }
      )
      .pipe(catchError((error) => this.handleError(error, 'register')));
  }

  forgotPassword(email: string, locale?: 'es' | 'en'): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(this.buildUrl('/forgot-password'), { email, locale })
      .pipe(catchError((error) => this.handleError(error, 'forgot')));
  }

  completeNewPassword(
    email: string,
    session: string,
    newPassword: string
  ): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(
        this.buildUrl('/complete-new-password'),
        { email, session, newPassword },
        { withCredentials: true }
      )
      .pipe(catchError((error) => this.handleError(error, 'reset')));
  }

  confirmEmail(token: string): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(this.buildUrl('/confirm-email'), { token })
      .pipe(catchError((error) => this.handleError(error, 'confirm')));
  }

  getUserProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(this.buildUrl('/me'));
  }

  updateUserProfile(
    payload: Partial<UserProfile>,
    options?: { skipLoading?: boolean }
  ): Observable<UserProfile> {
    const headers = options?.skipLoading
      ? new HttpHeaders({ 'x-skip-loading': 'true' })
      : undefined;
    return this.http.patch<UserProfile>(this.buildUrl('/me'), payload, {
      headers,
    });
  }

  getUserSettings(): Observable<UserSettings> {
    return this.http.get<UserSettings>(this.buildUrl('/settings'));
  }

  updateUserSettings(payload: Partial<UserSettings>): Observable<UserSettings> {
    return this.http.patch<UserSettings>(this.buildUrl('/settings'), payload);
  }

  deleteAccount(): Observable<{ message?: string }> {
    return this.http.delete<{ message?: string }>(this.buildUrl('/me'), {
      withCredentials: true,
    });
  }

  getGoogleAuthUrl(): string | null {
    const domain = environment.cognitoDomain?.trim();
    const clientId = environment.cognitoClientId?.trim();
    const redirectUri = environment.cognitoRedirectUri?.trim();
    if (!domain || !clientId || !redirectUri) {
      return null;
    }
    const base = domain.startsWith('http') ? domain : `https://${domain}`;
    const params = new URLSearchParams({
      response_type: 'token',
      client_id: clientId,
      redirect_uri: redirectUri,
      identity_provider: 'Google',
      scope: 'openid email profile',
    });
    return `${base}/oauth2/authorize?${params.toString()}`;
  }

  parseHostedUiTokens(hash: string): AuthTokens & { expiresIn?: number } | null {
    if (!hash || !hash.includes('id_token=')) {
      return null;
    }
    const raw = hash.startsWith('#') ? hash.slice(1) : hash;
    const params = new URLSearchParams(raw);
    const idToken = params.get('id_token');
    const accessToken = params.get('access_token');
    const expiresInRaw = params.get('expires_in');
    if (!idToken || !accessToken) {
      return null;
    }
    const expiresIn = expiresInRaw ? Number(expiresInRaw) : undefined;
    return {
      idToken,
      accessToken,
      expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
    };
  }

  private buildUrl(path: string) {
    const base = this.baseUrl || '';
    const authBase = this.resolveAuthBase(base);
    return `${authBase}${path}`;
  }

  private handleError(
    error: HttpErrorResponse,
    flow: 'login' | 'register' | 'forgot' | 'reset' | 'confirm'
  ) {
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

    if (flow === 'forgot') {
      if (message === 'User does not exist') {
        return throwError(() => new Error(t('errors.forgotNotFound')));
      }
      if (error.status === 400) {
        return throwError(() => new Error(t('errors.forgotInvalid')));
      }
      return throwError(() => new Error(t('errors.forgotDefault')));
    }

    if (flow === 'reset') {
      if (message === 'Invalid session') {
        return throwError(() => new Error(t('errors.resetInvalid')));
      }
      return throwError(() => new Error(t('errors.resetDefault')));
    }

    if (flow === 'confirm') {
      if (error.status === 400) {
        return throwError(() => new Error(t('errors.confirmInvalid')));
      }
      return throwError(() => new Error(t('errors.confirmDefault')));
    }

    return throwError(() => new Error(t('errors.network')));
  }

  private localizeChallenge(response: LoginResponse): LoginResponse {
    if (!('challenge' in response)) {
      return response;
    }

    return { ...response, message: this.i18n.t('errors.loginChallenge') };
  }

  async storeTokens(tokens: AuthTokens & { expiresIn?: number }, options?: { hasRefreshToken?: boolean }) {
    await this.storage.storeTokens(tokens, options);
  }

  getAccessToken() {
    return this.storage.getAccessToken();
  }

  getIdToken() {
    return this.storage.getIdToken();
  }

  hasStoredSession() {
    return this.storage.hasStoredSession();
  }

  hasRefreshToken() {
    return this.storage.hasRefreshToken();
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
