import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { I18nService, Locale } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-account-deleted',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, TranslateModule],
  templateUrl: './account-deleted.component.html',
  styleUrl: './account-deleted.component.scss',
})
export class AccountDeletedComponent {
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  get locale() {
    return this.i18n.locale;
  }

  setLocale(locale: Locale) {
    this.i18n.setLocale(locale);
  }

  backToLogin() {
    void this.router.navigate(['/']);
  }
}
