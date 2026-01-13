import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = (auth: AuthService) => {
  const refreshToken = localStorage.getItem('pettzi.refreshToken');
  if (!refreshToken) {
    return Promise.resolve(null);
  }

  if (!refreshPromise) {
    refreshPromise = firstValueFrom(auth.refreshTokens(refreshToken))
      .then((tokens) => tokens.accessToken)
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const isTokenExpired = (token: string) => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return false;
  }

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const exp = typeof payload?.exp === 'number' ? payload.exp * 1000 : 0;
    return exp > 0 && exp <= Date.now();
  } catch {
    return false;
  }
};

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isAuthRequest = req.url.includes('/auth/');
  const accessToken = localStorage.getItem('pettzi.accessToken');
  const refreshToken = localStorage.getItem('pettzi.refreshToken');

  if (isAuthRequest) {
    return next(req);
  }

  const attachToken = (token: string | null) =>
    token
      ? req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        })
      : req;

  const handleAuthError = (error: HttpErrorResponse) => {
    if (error.status !== 401 && error.status !== 403) {
      return throwError(() => error);
    }

    return from(refreshAccessToken(auth)).pipe(
      switchMap((newToken) => {
        if (!newToken) {
          auth.clearSession();
          void router.navigate(['/login']);
          return throwError(() => error);
        }
        return next(attachToken(newToken));
      }),
      catchError((refreshError) => {
        auth.clearSession();
        void router.navigate(['/login']);
        return throwError(() => refreshError);
      }),
    );
  };

  if (!accessToken && refreshToken) {
    return from(refreshAccessToken(auth)).pipe(
      switchMap((newToken) => {
        if (!newToken) {
          auth.clearSession();
          void router.navigate(['/login']);
          return throwError(() => new HttpErrorResponse({ status: 401 }));
        }
        return next(attachToken(newToken));
      }),
      catchError((refreshError) => {
        auth.clearSession();
        void router.navigate(['/login']);
        return throwError(() => refreshError);
      }),
    );
  }

  if (accessToken && refreshToken && isTokenExpired(accessToken)) {
    return from(refreshAccessToken(auth)).pipe(
      switchMap((newToken) => {
        if (!newToken) {
          auth.clearSession();
          void router.navigate(['/login']);
          return throwError(() => new HttpErrorResponse({ status: 401 }));
        }
        return next(attachToken(newToken));
      }),
      catchError((refreshError) => {
        auth.clearSession();
        void router.navigate(['/login']);
        return throwError(() => refreshError);
      }),
    );
  }

  return next(attachToken(accessToken)).pipe(catchError(handleAuthError));
};
