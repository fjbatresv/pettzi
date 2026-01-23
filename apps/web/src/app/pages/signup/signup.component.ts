import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-signup',
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TranslateModule],
  standalone: true,
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent {
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly inviteTokenKey = 'pettzi.petInviteToken';

  readonly form = this.fb.group({
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
    acceptTerms: [false, [Validators.requiredTrue]],
  });

  errorMessage = '';
  isSubmitting = false;

  get locale() {
    return this.i18n.locale;
  }

  setLocale(locale: 'es' | 'en') {
    this.i18n.setLocale(locale);
  }

  submit() {
    this.errorMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, email, password, confirmPassword } = this.form.getRawValue();
    if (!name || !email || !password) {
      return;
    }

    if (password !== confirmPassword) {
      this.errorMessage = this.i18n.t('signup.confirmError');
      return;
    }

    this.isSubmitting = true;
    this.auth.register(name.trim(), email, password, this.locale).subscribe({
      next: (tokens) => {
        this.errorMessage = '';
        this.persistTokens(tokens);
        const inviteToken = sessionStorage.getItem(this.inviteTokenKey);
        if (inviteToken) {
          void this.router.navigate(['/accept-invite'], { queryParams: { token: inviteToken } });
          return;
        }
        void this.router.navigate(['/pets/new']);
      },
      error: (err: Error) => {
        this.errorMessage = err.message;
        this.isSubmitting = false;
      },
      complete: () => {
        this.isSubmitting = false;
      },
    });
  }

  hasError(controlName: keyof typeof this.form.controls) {
    const control = this.form.get(controlName);
    return !!control && control.touched && control.invalid;
  }

  private persistTokens(tokens: {
    idToken: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }) {
    void this.auth.storeTokens(tokens);
  }
}
