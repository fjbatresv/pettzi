import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { LoadingService } from '../services/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loading = inject(LoadingService);
  const skipLoading = req.headers.get('x-skip-loading') === 'true';
  if (skipLoading) {
    const cleaned = req.clone({
      headers: req.headers.delete('x-skip-loading'),
    });
    return next(cleaned);
  }

  loading.show();
  return next(req).pipe(finalize(() => loading.hide()));
};
