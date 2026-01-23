import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { I18nService, Locale } from '../../core/i18n/i18n.service';

type Stage = 'form' | 'sent';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatIconModule, TranslateModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  stage: Stage = 'form';
  isSubmitting = false;
  errorMessage = '';
  lastEmail = '';

  form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  get locale() {
    return this.i18n.locale;
  }

  setLocale(locale: Locale) {
    this.i18n.setLocale(locale);
  }

  hasError(controlName: 'email') {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  submit() {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    this.errorMessage = '';
    this.isSubmitting = true;
    const email = this.form.value.email?.trim() ?? '';
    this.lastEmail = email;
    this.auth.forgotPassword(email, this.locale).subscribe({
      next: () => {
        this.stage = 'sent';
        this.isSubmitting = false;
      },
      error: (err: Error) => {
        this.errorMessage = err.message;
        this.isSubmitting = false;
      },
    });
  }

  resend() {
    if (!this.lastEmail || this.isSubmitting) {
      return;
    }
    this.errorMessage = '';
    this.isSubmitting = true;
    this.auth.forgotPassword(this.lastEmail, this.locale).subscribe({
      next: () => {
        this.isSubmitting = false;
      },
      error: (err: Error) => {
        this.errorMessage = err.message;
        this.isSubmitting = false;
      },
    });
  }

  backToLogin() {
    void this.router.navigate(['/login']);
  }
}
