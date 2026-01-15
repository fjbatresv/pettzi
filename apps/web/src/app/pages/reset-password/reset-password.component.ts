import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { I18nService, Locale } from '../../core/i18n/i18n.service';
import { PetsService } from '../../core/services/pets.service';

type PasswordStrength = 'weak' | 'medium' | 'strong';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly pets = inject(PetsService);
  private readonly sessionKey = 'pettzi.resetPasswordSession';

  isSubmitting = false;
  errorMessage = '';

  form = new FormGroup({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  get locale() {
    return this.i18n.locale;
  }

  setLocale(locale: Locale) {
    this.i18n.setLocale(locale);
  }

  get strength() {
    return this.getStrength(this.form.value.password ?? '');
  }

  get strengthPercent() {
    if (this.strength === 'strong') {
      return 85;
    }
    if (this.strength === 'medium') {
      return 55;
    }
    return 25;
  }

  get strengthLabel() {
    if (this.strength === 'strong') {
      return this.i18n.t('reset.strengthStrong');
    }
    if (this.strength === 'medium') {
      return this.i18n.t('reset.strengthMedium');
    }
    return this.i18n.t('reset.strengthWeak');
  }

  hasError(controlName: 'password' | 'confirmPassword') {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  passwordsMatch() {
    const password = this.form.value.password ?? '';
    const confirm = this.form.value.confirmPassword ?? '';
    return password.length > 0 && password === confirm;
  }

  submit() {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.passwordsMatch()) {
      this.errorMessage = this.i18n.t('reset.mismatch');
      return;
    }

    const sessionData = this.getStoredSession();
    if (!sessionData) {
      this.errorMessage = this.i18n.t('reset.sessionMissing');
      return;
    }

    this.errorMessage = '';
    this.isSubmitting = true;
    this.auth
      .completeNewPassword(sessionData.email, sessionData.session, this.form.value.password ?? '')
      .subscribe({
        next: async (tokens) => {
          await this.auth.storeTokens(tokens);
          sessionStorage.removeItem(this.sessionKey);
          this.routeAfterLogin();
        },
        error: (err: Error) => {
          this.errorMessage = err.message;
          this.isSubmitting = false;
        },
      });
  }

  private routeAfterLogin() {
    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        if (!pets || pets.length === 0) {
          void this.router.navigate(['/pets/new']);
          return;
        }
        if (pets.length === 1) {
          void this.router.navigate(['/dashboard/pet']);
          return;
        }
        void this.router.navigate(['/dashboard/main']);
      },
      error: () => {
        void this.router.navigate(['/pets/new']);
      },
    });
  }

  private getStoredSession(): { email: string; session: string } | null {
    const raw = sessionStorage.getItem(this.sessionKey);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { email?: string; session?: string };
      if (!parsed?.email || !parsed?.session) {
        return null;
      }
      return { email: parsed.email, session: parsed.session };
    } catch {
      return null;
    }
  }

  private getStrength(value: string): PasswordStrength {
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSymbol = /[^A-Za-z0-9]/.test(value);
    const score = [hasUpper, hasLower, hasNumber, hasSymbol].filter(Boolean).length;

    if (value.length >= 10 && score >= 3) {
      return 'strong';
    }
    if (value.length >= 8 && score >= 2) {
      return 'medium';
    }
    return 'weak';
  }
}
