import { Injectable, inject } from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export type Locale = 'es' | 'en';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly storageKey = 'pettzi.locale';
  private readonly translate = inject(TranslateService);
  private readonly dateAdapter = inject(DateAdapter);

  init() {
    const stored = localStorage.getItem(this.storageKey) as Locale | null;
    const locale = stored === 'en' ? 'en' : 'es';
    this.translate.setDefaultLang('es');
    this.applyLocale(locale);
    return firstValueFrom(this.translate.use(locale));
  }

  get locale(): Locale {
    const current = this.translate.currentLang as Locale | undefined;
    return current ?? (this.translate.defaultLang as Locale) ?? 'es';
  }

  setLocale(locale: Locale) {
    if (locale === this.locale) {
      return;
    }

    localStorage.setItem(this.storageKey, locale);
    this.applyLocale(locale);
    this.translate.use(locale).subscribe();
  }

  private applyLocale(locale: Locale) {
    document.documentElement.lang = locale;
    const adapterLocale = locale === 'en' ? 'en-US' : 'es-ES';
    this.dateAdapter.setLocale(adapterLocale);
  }

  t(key: string) {
    return this.translate.instant(key);
  }
}
