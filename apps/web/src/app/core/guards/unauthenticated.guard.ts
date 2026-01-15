import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, from, map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const unauthenticatedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.hasStoredSession()) {
    return router.createUrlTree(['/dashboard']);
  }

  return from(auth.getAccessToken()).pipe(
    switchMap((accessToken) => {
      if (accessToken) {
        return of(router.createUrlTree(['/dashboard']));
      }
      if (!auth.hasRefreshToken()) {
        return of(true);
      }
      return auth.refreshTokens().pipe(
        map(() => router.createUrlTree(['/dashboard'])),
        catchError(() => of(true))
      );
    })
  );
};
