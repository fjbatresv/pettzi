import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { PetsService } from '../../core/services/pets.service';
import { OwnersService } from '../../core/services/owners.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-login',
  imports: [CommonModule, RouterLink, ReactiveFormsModule, TranslateModule],
  standalone: true,
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly pets = inject(PetsService);
  private readonly owners = inject(OwnersService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly resetSessionKey = 'pettzi.resetPasswordSession';
  private readonly inviteTokenKey = 'pettzi.petInviteToken';

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  errorMessage = '';
  challengeMessage = '';
  isSubmitting = false;

  ngOnInit() {
    if (this.handleHostedUiCallback()) {
      return;
    }
    void this.redirectIfAuthenticated();
  }

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
      next: async (response) => {
        if ('challenge' in response) {
          sessionStorage.setItem(
            this.resetSessionKey,
            JSON.stringify({ email, session: response.session })
          );
          void this.router.navigate(['/reset-password']);
          return;
        }
        this.challengeMessage = '';
        await this.persistTokens(response);
        this.redirectAfterLogin();
      },
      error: (err: Error) => {
        this.errorMessage = err.message;
        this.isSubmitting = false;
      },
    });
  }

  loginWithGoogle() {
    const url = this.auth.getGoogleAuthUrl();
    if (!url) {
      return;
    }
    window.location.assign(url);
  }

  hasError(controlName: 'email' | 'password') {
    const control = this.form.get(controlName);
    return !!control && control.touched && control.invalid;
  }

  private async persistTokens(
    tokens: {
    idToken: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  },
    options?: { hasRefreshToken?: boolean }
  ) {
    await this.auth.storeTokens(tokens, options);
  }

  private async redirectIfAuthenticated() {
    const accessToken = await this.auth.getAccessToken();
    if (accessToken) {
      await this.redirectAfterLogin();
      return;
    }
    if (!this.auth.hasRefreshToken()) {
      return;
    }
    this.auth.refreshTokens().subscribe({
      next: () => {
        void this.redirectAfterLogin();
      },
      error: () => {
        // stay on login
      },
    });
  }

  private async redirectAfterLogin() {
    const inviteToken = sessionStorage.getItem(this.inviteTokenKey);
    if (inviteToken) {
      void this.router.navigate(['/accept-invite'], { queryParams: { token: inviteToken } });
      this.isSubmitting = false;
      return;
    }
    try {
      const { invites } = await firstValueFrom(this.owners.listPendingPetInvites());
      if (invites && invites.length > 0) {
        void this.router.navigate(['/invites']);
        this.isSubmitting = false;
        return;
      }
    } catch {
      // fall through to pet flow
    }
    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        if (!pets || pets.length === 0) {
          void this.router.navigate(['/pets/new']);
          return;
        }
        if (pets.length == 1) {
          void this.router.navigate(['/pets', pets[0].petId]);
          return;
        }
        if (pets.length > 1) {
          void this.router.navigate(['/home']);
        }
      },
      error: () => {
        void this.router.navigate(['/pets/new']);
      },
      complete: () => {
        this.isSubmitting = false;
      },
    });
  }

  private handleHostedUiCallback() {
    const tokens = this.auth.parseHostedUiTokens(window.location.hash);
    if (!tokens) {
      return false;
    }
    this.isSubmitting = true;
    void this.persistTokens(tokens, { hasRefreshToken: false }).then(() => {
      window.history.replaceState({}, document.title, window.location.pathname);
      this.redirectAfterLogin();
    });
    return true;
  }
}
