import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from '@sentry/browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

if (environment.sentryDsn) {
  const sentryAny = Sentry as any;
  const integrations: any[] = [];
  if (typeof sentryAny.browserTracingIntegration === 'function') {
    integrations.push(
      sentryAny.browserTracingIntegration()
    );
  } else if (sentryAny.BrowserTracing) {
    integrations.push(
      new sentryAny.BrowserTracing({
        tracingOrigins: ['localhost', environment.apiBaseUrl],
      })
    );
  }

  Sentry.init({
    dsn: environment.sentryDsn,
    environment: environment.production ? 'prod' : 'dev',
    release: environment.sentryRelease || undefined,
    tracesSampleRate: Number(environment.sentryTracesSampleRate ?? 0),
    profilesSampleRate: Number(environment.sentryProfilesSampleRate ?? 0),
    integrations,
  });
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
