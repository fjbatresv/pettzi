import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, from, map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const unauthenticatedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.hasStoredSession()) {
    return router.createUrlTree(['/home']);
  }

  return from(auth.getAccessToken()).pipe(
    switchMap((accessToken) => {
      if (accessToken) {
        return of(router.createUrlTree(['/home']));
      }
      if (!auth.hasRefreshToken()) {
        return of(true);
      }
      return auth.refreshTokens().pipe(
        map(() => router.createUrlTree(['/home'])),
        catchError(() => of(true))
      );
    })
  );
};
