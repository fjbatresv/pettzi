import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-language-toggle',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './language-toggle.component.html',
  styleUrl: './language-toggle.component.scss',
})
export class LanguageToggleComponent {
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  @Input() disableProfileUpdate = false;

  get locale() {
    return this.i18n.locale;
  }

  setLocale(locale: 'es' | 'en') {
    this.i18n.setLocale(locale);
    if (!this.disableProfileUpdate && this.auth.hasStoredSession()) {
      this.auth.updateUserProfile({ locale }, { skipLoading: true }).subscribe({
        error: () => undefined,
      });
    }
  }
}
