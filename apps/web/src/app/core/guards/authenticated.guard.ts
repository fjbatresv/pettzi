import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, from, map, of, switchMap } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authenticatedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.hasStoredSession()) {
    return true;
  }

  return from(auth.getAccessToken()).pipe(
    switchMap((accessToken) => {
      if (accessToken) {
        return of(true);
      }
      if (!auth.hasRefreshToken()) {
        return of(router.createUrlTree(['/login']));
      }
      return auth.refreshTokens().pipe(
        map(() => true),
        catchError(() => of(router.createUrlTree(['/login'])))
      );
    })
  );
};
