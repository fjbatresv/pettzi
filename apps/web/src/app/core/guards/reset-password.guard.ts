import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const resetPasswordGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const resetSessionKey = 'pettzi.resetPasswordSession';

  const hasResetSession = !!sessionStorage.getItem(resetSessionKey);
  if (hasResetSession) {
    return true;
  }
  if (auth.hasStoredSession()) {
    return router.createUrlTree(['/home']);
  }
  return router.createUrlTree(['/login']);
};
