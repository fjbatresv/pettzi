import { ErrorHandler, Injectable } from '@angular/core';
import * as Sentry from '@sentry/browser';

@Injectable()
export class SentryErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    Sentry.captureException(error);
    // Let Angular handle console output and default behavior.
    // eslint-disable-next-line no-console
    console.error(error);
  }
}
