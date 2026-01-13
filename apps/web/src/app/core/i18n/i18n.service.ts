import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

export type Locale = 'es' | 'en';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly storageKey = 'pettzi.locale';

  constructor(private readonly translate: TranslateService) {}

  init() {
    const stored = localStorage.getItem(this.storageKey) as Locale | null;
    const locale = stored === 'en' ? 'en' : 'es';
    this.translate.setDefaultLang('es');
    document.documentElement.lang = locale;
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
    document.documentElement.lang = locale;
    this.translate.use(locale).subscribe();
  }

  t(key: string) {
    return this.translate.instant(key);
  }
}
