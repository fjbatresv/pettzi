import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { PetsService } from '../../core/services/pets.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TranslateModule],
  standalone: true,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly pets = inject(PetsService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  errorMessage = '';
  challengeMessage = '';
  isSubmitting = false;

  get locale() {
    return this.i18n.locale;
  }

  setLocale(locale: 'es' | 'en') {
    this.i18n.setLocale(locale);
  }

  submit() {
    this.errorMessage = '';
    this.challengeMessage = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    if (!email || !password) {
      return;
    }

    this.isSubmitting = true;
    this.auth.login(email, password).subscribe({
      next: (response) => {
        if ('challenge' in response) {
          this.challengeMessage = response.message;
          this.isSubmitting = false;
          return;
        }
        this.challengeMessage = '';
        this.persistTokens(response);
        this.pets.listPets().subscribe({
          next: ({ pets }) => {
            if (!pets || pets.length === 0) {
              void this.router.navigate(['/pets/new']);
              return;
            }
            void this.router.navigate(['/']);
          },
          error: () => {
            void this.router.navigate(['/pets/new']);
          },
          complete: () => {
            this.isSubmitting = false;
          },
        });
      },
      error: (err: Error) => {
        this.errorMessage = err.message;
        this.isSubmitting = false;
      },
    });
  }

  hasError(controlName: 'email' | 'password') {
    const control = this.form.get(controlName);
    return !!control && control.touched && control.invalid;
  }

  private persistTokens(tokens: {
    idToken: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }) {
    localStorage.setItem('pettzi.idToken', tokens.idToken);
    localStorage.setItem('pettzi.accessToken', tokens.accessToken);
    if (tokens.refreshToken) {
      localStorage.setItem('pettzi.refreshToken', tokens.refreshToken);
    }
    if (tokens.expiresIn) {
      const expiresAt = Date.now() + tokens.expiresIn * 1000;
      localStorage.setItem('pettzi.accessTokenExpiresAt', String(expiresAt));
    }
  }
}
