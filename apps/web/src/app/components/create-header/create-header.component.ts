import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageToggleComponent } from '../language-toggle/language-toggle.component';
import { AuthService } from '../../core/services/auth.service';
import { UploadsService } from '../../core/services/uploads.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-create-header',
  standalone: true,
  imports: [CommonModule, TranslateModule, LanguageToggleComponent],
  templateUrl: './create-header.component.html',
  styleUrl: './create-header.component.scss',
})
export class CreateHeaderComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly uploads = inject(UploadsService);
  @Input() userName = '';

  avatarLabel = '??';
  avatarUrl = '';

  ngOnInit() {
    void this.loadAvatar();
  }

  private async loadAvatar() {
    let resolvedName = this.userName.trim();
    try {
      const profile = await firstValueFrom(this.auth.getUserProfile());
      const profileName =
        profile.fullName?.trim() ||
        [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
      if (!resolvedName && profileName) {
        resolvedName = profileName;
      }
      const photoKey = profile.profilePhotoKey?.trim();
      if (photoKey) {
        this.loadProfilePhoto(photoKey);
      }
    } catch {
      // fallback to token below
    }

    if (!resolvedName) {
      resolvedName = await this.getNameFromToken();
    }
    this.avatarLabel = this.buildAvatarLabel(resolvedName);
  }

  private loadProfilePhoto(fileKey: string) {
    this.uploads.generateProfileDownloadUrl(fileKey).subscribe({
      next: ({ downloadUrl }) => {
        this.avatarUrl = downloadUrl;
      },
    });
  }

  private async getNameFromToken() {
    const token = await this.auth.getIdToken();
    if (!token) {
      return '';
    }

    const parts = token.split('.');
    if (parts.length < 2) {
      return '';
    }

    try {
      const payload = JSON.parse(this.decodeBase64Url(parts[1])) as Record<string, unknown>;
      const given = this.getStringField(payload, ['given_name', 'givenName']);
      const family = this.getStringField(payload, ['family_name', 'familyName']);
      const fullName = [given, family].filter(Boolean).join(' ').trim();
      if (fullName) {
        return fullName;
      }

      return this.getStringField(payload, ['name', 'preferred_username']) || '';
    } catch {
      return '';
    }
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

    const single = parts[0] ?? '';
    return single.slice(0, 2).toUpperCase();
  }
}
