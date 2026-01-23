import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DeleteAccountDialogComponent } from './delete-account-dialog.component';
import { UploadsService } from '../../core/services/uploads.service';

type SettingsSection = 'profile' | 'notifications' | 'security' | 'billing';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatDialogModule,
    TranslateModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly uploads = inject(UploadsService);

  activeSection: SettingsSection = 'profile';
  userName = '';
  userInitials = '??';
  memberSince = 'January 2023';
  profilePhotoUrl = '';
  profilePhotoPreviewUrl = '';
  profilePhotoKey = '';
  isUploadingPhoto = false;
  private pendingPhotoFile: File | null = null;
  private readonly weightUnitKey = 'pettzi.weightUnit';
  private readonly distanceUnitKey = 'pettzi.distanceUnit';

  profile = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  };
  profileError = '';
  isSavingProfile = false;

  preferences: {
    theme: 'light' | 'dark';
    weightUnit: 'kg' | 'lb';
    distanceUnit: 'm' | 'in';
    newsletter: boolean;
  } = {
    theme: 'light',
    weightUnit: 'kg',
    distanceUnit: 'm',
    newsletter: true,
  };
  isSavingPreferences = false;
  preferencesError = '';

  notifications = {
    vetVisits: true,
    medication: true,
    grooming: true,
    coOwner: false,
  };

  security = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    twoFactor: false,
  };
  deleteError = '';
  isDeletingAccount = false;
  private readonly confirmWords = [
    'BORRAR',
    'ELIMINAR',
    'PETTZI',
    'MASCOTA',
    'SEGURIDAD',
  ];

  ngOnInit() {
    void this.loadUserProfile();
    void this.loadUserSettings();
  }

  setSection(section: SettingsSection) {
    this.activeSection = section;
  }

  isActive(section: SettingsSection) {
    return this.activeSection === section;
  }

  logout() {
    this.auth.clearSession();
    void this.router.navigate(['/login']);
  }

  async requestDeleteAccount() {
    if (this.isDeletingAccount) {
      return;
    }
    const word = this.getRandomWord();
    const ref = this.dialog.open(DeleteAccountDialogComponent, {
      data: { word },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) {
      return;
    }

    this.isDeletingAccount = true;
    this.deleteError = '';
    try {
      await firstValueFrom(this.auth.deleteAccount());
      this.auth.clearSession();
      this.clearLocalData();
      void this.router.navigate(['/account-deleted']);
    } catch (error: any) {
      this.deleteError = error?.message ?? '';
    } finally {
      this.isDeletingAccount = false;
    }
  }

  private async loadUserProfile() {
    this.profileError = '';
    try {
      const profile = await firstValueFrom(this.auth.getUserProfile());
      this.applyProfile(profile);
      if (profile.profilePhotoKey) {
        this.loadProfilePhoto(profile.profilePhotoKey);
      }
      return;
    } catch {
      // fallback to token parsing below
    }

    const token = await this.auth.getIdToken();
    if (!token) {
      return;
    }
    const parts = token.split('.');
    if (parts.length < 2) {
      return;
    }
    try {
      const payload = JSON.parse(this.decodeBase64Url(parts[1])) as Record<string, unknown>;
      const given = this.getStringField(payload, ['given_name', 'givenName']);
      const family = this.getStringField(payload, ['family_name', 'familyName']);
      const name = [given, family].filter(Boolean).join(' ').trim();
      const email = this.getStringField(payload, ['email']);

      this.userName = name || email || '';
      this.userInitials = this.buildAvatarLabel(name);
      this.profile.firstName = given || '';
      this.profile.lastName = family || '';
      this.profile.email = email || '';
    } catch {
      return;
    }
  }

  saveProfile() {
    if (this.isSavingProfile) {
      return;
    }
    this.profileError = '';
    this.isSavingProfile = true;

    void this.saveProfileWithPhoto();
  }

  savePreferences() {
    if (this.isSavingPreferences) {
      return;
    }
    this.isSavingPreferences = true;
    this.preferencesError = '';

    this.auth
      .updateUserSettings({
        theme: this.preferences.theme,
        weightUnit: this.preferences.weightUnit,
        distanceUnit: this.preferences.distanceUnit,
        newsletter: this.preferences.newsletter,
      })
      .subscribe({
        next: (settings) => {
          this.applySettings(settings);
          this.isSavingPreferences = false;
        },
        error: (err: Error) => {
          this.preferencesError = err.message;
          this.isSavingPreferences = false;
        },
      });
  }

  private applyProfile(profile: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    fullName?: string;
    profilePhotoKey?: string;
  }) {
    const firstName = profile.firstName?.trim() ?? '';
    const lastName = profile.lastName?.trim() ?? '';
    const fullName = profile.fullName?.trim() ?? [firstName, lastName].filter(Boolean).join(' ').trim();
    const email = profile.email?.trim() ?? '';

    this.profile.firstName = firstName;
    this.profile.lastName = lastName;
    this.profile.email = email;
    this.profile.phone = profile.phone?.trim() ?? '';
    this.profilePhotoKey = profile.profilePhotoKey?.trim() ?? '';
    this.userName = fullName || email;
    this.userInitials = this.buildAvatarLabel(fullName);
  }

  private async loadUserSettings() {
    try {
      const settings = await firstValueFrom(this.auth.getUserSettings());
      this.applySettings(settings);
    } catch {
      // keep defaults when settings not available
    }
  }

  private applySettings(settings: {
    theme?: 'light' | 'dark';
    weightUnit?: 'kg' | 'lb';
    distanceUnit?: 'm' | 'in';
    newsletter?: boolean;
  }) {
    if (settings.theme) {
      this.preferences.theme = settings.theme;
    }
    if (settings.weightUnit) {
      this.preferences.weightUnit = settings.weightUnit;
      localStorage.setItem(this.weightUnitKey, settings.weightUnit);
    }
    if (settings.distanceUnit) {
      this.preferences.distanceUnit = settings.distanceUnit;
      localStorage.setItem(this.distanceUnitKey, settings.distanceUnit);
    }
    if (settings.newsletter !== undefined) {
      this.preferences.newsletter = settings.newsletter;
    }
  }

  async onProfilePhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.isUploadingPhoto) {
      return;
    }

    this.pendingPhotoFile = file;
    if (this.profilePhotoPreviewUrl) {
      URL.revokeObjectURL(this.profilePhotoPreviewUrl);
    }
    this.profilePhotoPreviewUrl = URL.createObjectURL(file);
    input.value = '';
  }

  private async saveProfileWithPhoto() {
    try {
      let uploadedPhotoKey: string | undefined;
      if (this.pendingPhotoFile) {
        this.isUploadingPhoto = true;
        const contentType = this.pendingPhotoFile.type || 'image/jpeg';
        const upload = await firstValueFrom(
          this.uploads.generateProfilePhotoUploadUrl(contentType)
        );

        const uploadResponse = await fetch(upload.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
          },
          body: this.pendingPhotoFile,
        });

        if (!uploadResponse.ok) {
          throw new Error('Upload failed');
        }
        uploadedPhotoKey = upload.fileKey;
      }

      const payload = {
        firstName: this.profile.firstName.trim(),
        lastName: this.profile.lastName.trim(),
        phone: this.profile.phone.trim(),
        ...(uploadedPhotoKey ? { profilePhotoKey: uploadedPhotoKey } : {}),
      };

      const profile = await firstValueFrom(this.auth.updateUserProfile(payload));
      this.applyProfile(profile);
      if (uploadedPhotoKey) {
        this.loadProfilePhoto(uploadedPhotoKey);
        if (this.profilePhotoPreviewUrl) {
          URL.revokeObjectURL(this.profilePhotoPreviewUrl);
        }
        this.profilePhotoPreviewUrl = '';
        this.pendingPhotoFile = null;
      }
    } catch (error: any) {
      this.profileError = error?.message ?? '';
    } finally {
      this.isSavingProfile = false;
      this.isUploadingPhoto = false;
    }
  }

  private loadProfilePhoto(fileKey: string) {
    if (!fileKey) {
      this.profilePhotoUrl = '';
      return;
    }
    this.uploads.generateProfileDownloadUrl(fileKey).subscribe({
      next: ({ downloadUrl }) => {
        this.profilePhotoUrl = downloadUrl;
      },
    });
  }

  private getStringField(payload: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  private decodeBase64Url(value: string) {
    const base = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base.padEnd(Math.ceil(base.length / 4) * 4, '=');
    return atob(padded);
  }

  private buildAvatarLabel(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return '??';
    }
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
    }
    return (parts[0] ?? '').slice(0, 2).toUpperCase();
  }

  private getRandomWord() {
    const index = Math.floor(Math.random() * this.confirmWords.length);
    return this.confirmWords[index] ?? 'PETTZI';
  }

  private clearLocalData() {
    sessionStorage.clear();
    localStorage.removeItem('pettzi.activePetId');
    localStorage.removeItem('pettzi.weightUnit');
  }
}
