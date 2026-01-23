import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { OwnersService, PetInvitePreview } from '../../core/services/owners.service';

@Component({
  selector: 'app-pet-invite-confirm',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './pet-invite-confirm.component.html',
  styleUrl: './pet-invite-confirm.component.scss',
})
export class PetInviteConfirmComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly owners = inject(OwnersService);
  private readonly i18n = inject(I18nService);
  private readonly inviteTokenKey = 'pettzi.petInviteToken';
  private readonly inviteAutoAcceptKey = 'pettzi.petInviteAutoAccept';
  private readonly activePetKey = 'pettzi.activePetId';

  invite: PetInvitePreview | null = null;
  inviteToken = '';
  isLoading = true;
  isAccepting = false;
  isAuthenticated = false;
  errorMessage = '';
  userName = '';
  userInitial = '';
  inviteAccepted = false;

  async ngOnInit() {
    this.inviteToken =
      this.route.snapshot.queryParamMap.get('token') ??
      sessionStorage.getItem(this.inviteTokenKey) ??
      '';

    if (!this.inviteToken) {
      this.isLoading = false;
      this.errorMessage = this.i18n.t('petInvite.invalid');
      return;
    }

    this.isAuthenticated = await this.resolveAuth();

    if (this.isAuthenticated) {
      await this.loadUserProfile();
    }

    await this.loadPreview();

    if (this.isAuthenticated && sessionStorage.getItem(this.inviteAutoAcceptKey) === 'true') {
      sessionStorage.removeItem(this.inviteAutoAcceptKey);
      this.acceptInvite(true);
    }
  }

  get acceptLabel() {
    return this.isAuthenticated
      ? this.i18n.t('petInvite.accept')
      : this.i18n.t('petInvite.loginCta');
  }

  acceptInvite(auto = false) {
    if (!this.inviteToken || this.isAccepting) {
      return;
    }
    if (!this.isAuthenticated) {
      sessionStorage.setItem(this.inviteTokenKey, this.inviteToken);
      sessionStorage.setItem(this.inviteAutoAcceptKey, 'true');
      void this.router.navigate(['/login']);
      return;
    }

    this.isAccepting = true;
    this.errorMessage = '';

    this.owners.acceptPetInvite(this.inviteToken).subscribe({
      next: (response) => {
        this.invite = response;
        this.inviteAccepted = true;
        if (response.pet?.petId) {
          localStorage.setItem(this.activePetKey, response.pet.petId);
        }
        sessionStorage.removeItem(this.inviteTokenKey);
        sessionStorage.removeItem(this.inviteAutoAcceptKey);
        if (!auto) {
          this.isAccepting = false;
        }
      },
      error: (err: Error) => {
        this.errorMessage = err.message || this.i18n.t('petInvite.acceptError');
        this.isAccepting = false;
      },
      complete: () => {
        this.isAccepting = false;
      },
    });
  }

  declineInvite() {
    sessionStorage.removeItem(this.inviteTokenKey);
    sessionStorage.removeItem(this.inviteAutoAcceptKey);
    if (this.isAuthenticated) {
      void this.router.navigate(['/home']);
      return;
    }
    void this.router.navigate(['/login']);
  }

  private async loadPreview() {
    this.isLoading = true;
    this.errorMessage = '';
    try {
      this.invite = await firstValueFrom(this.owners.previewPetInvite(this.inviteToken));
      this.inviteAccepted =
        this.invite?.status === 'accepted' || this.invite?.status === 'already-linked';
    } catch {
      this.errorMessage = this.i18n.t('petInvite.invalid');
    } finally {
      this.isLoading = false;
    }
  }

  private async resolveAuth() {
    if (this.auth.hasStoredSession()) {
      return true;
    }
    const accessToken = await this.auth.getAccessToken();
    return !!accessToken;
  }

  private async loadUserProfile() {
    try {
      const profile = await firstValueFrom(this.auth.getUserProfile());
      this.userName = profile.fullName || profile.email || '';
      this.userInitial = this.userName ? this.userName.trim().charAt(0).toUpperCase() : '';
    } catch {
      this.userName = '';
      this.userInitial = '';
    }
  }
}
