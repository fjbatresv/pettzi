import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { TranslateModule } from '@ngx-translate/core';
import { Pet } from '@pettzi/domain-model';
import { LanguageToggleComponent } from '../language-toggle/language-toggle.component';
import { PetsService } from '../../core/services/pets.service';
import { UploadsService } from '../../core/services/uploads.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatSidenavModule,
    TranslateModule,
    LanguageToggleComponent,
  ],
  templateUrl: './dashboard-layout.component.html',
  styleUrl: './dashboard-layout.component.scss',
})
export class DashboardLayoutComponent implements OnInit {
  private readonly pets = inject(PetsService);
  private readonly uploads = inject(UploadsService);
  private readonly auth = inject(AuthService);

  activePet: Pet | null = null;
  activePetPhotoUrl = '';
  userInitials = '??';
  userPhotoUrl = '';
  activePetAge = '';
  isMobile = false;

  ngOnInit() {
    this.updateViewport();
    void this.loadUserProfile();
    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        this.activePet = pets?.[0] ?? null;
        this.activePetAge = this.getAgeLabel(this.activePet?.birthDate);
        const photoKey =
          this.activePet?.photoThumbnailKey ?? this.activePet?.photoKey;
        if (this.activePet?.petId && photoKey) {
          this.loadPhoto(this.activePet.petId, photoKey);
        }
      },
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.updateViewport();
  }

  private updateViewport() {
    if (typeof window === 'undefined') {
      return;
    }
    this.isMobile = window.matchMedia('(max-width: 720px)').matches;
  }

  private loadPhoto(petId: string, fileKey: string) {
    this.uploads.generateDownloadUrl(petId, fileKey).subscribe({
      next: ({ downloadUrl }) => {
        this.activePetPhotoUrl = downloadUrl;
      },
    });
  }

  private async loadUserProfile() {
    try {
      const profile = await firstValueFrom(this.auth.getUserProfile());
      const name =
        profile.fullName?.trim() ||
        [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
      this.userInitials = this.buildAvatarLabel(name);
      const photoKey = profile.profilePhotoKey?.trim();
      if (photoKey) {
        this.loadProfilePhoto(photoKey);
      }
      return;
    } catch {
      // fallback to token parsing below
    }

    const name = await this.getUserNameFromToken();
    this.userInitials = this.buildAvatarLabel(name);
  }

  private loadProfilePhoto(fileKey: string) {
    this.uploads.generateProfileDownloadUrl(fileKey).subscribe({
      next: ({ downloadUrl }) => {
        this.userPhotoUrl = downloadUrl;
      },
    });
  }

  private async getUserNameFromToken() {
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
      const fullName = this.getStringField(payload, ['name']);
      if (fullName) {
        return fullName;
      }
      const given = this.getStringField(payload, ['given_name']);
      const family = this.getStringField(payload, ['family_name']);
      return [given, family].filter(Boolean).join(' ').trim() || '';
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
    return (parts[0] ?? '').slice(0, 2).toUpperCase();
  }

  private getAgeLabel(birthDate?: Date | string) {
    if (!birthDate) {
      return '';
    }
    const birth = birthDate instanceof Date ? birthDate : new Date(birthDate);
    if (Number.isNaN(birth.getTime())) {
      return '';
    }
    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    let days = today.getDate() - birth.getDate();

    if (days < 0) {
      const daysInPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
      days += daysInPrevMonth;
      months -= 1;
    }

    if (months < 0) {
      months += 12;
      years -= 1;
    }

    if (years > 0) {
      return `${years} years old`;
    }
    return `${Math.max(months, 0)} months old`;
  }
}
