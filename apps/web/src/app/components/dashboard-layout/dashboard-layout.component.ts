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

  activePet: Pet | null = null;
  activePetPhotoUrl = '';
  userInitials = '??';
  activePetAge = '';
  isMobile = false;

  ngOnInit() {
    this.updateViewport();
    this.userInitials = this.buildAvatarLabel(this.getUserNameFromToken());
    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        this.activePet = pets?.[0] ?? null;
        this.activePetAge = this.getAgeLabel(this.activePet?.birthDate);
        if (this.activePet?.petId && this.activePet.photoKey) {
          this.loadPhoto(this.activePet.petId, this.activePet.photoKey);
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

  private getUserNameFromToken() {
    const token = localStorage.getItem('pettzi.idToken');
    if (!token) {
      return '';
    }
    const parts = token.split('.');
    if (parts.length < 2) {
      return '';
    }
    try {
      const payload = JSON.parse(this.decodeBase64Url(parts[1])) as Record<string, unknown>;
      return (
        this.getStringField(payload, ['name', 'given_name', 'family_name', 'preferred_username', 'email']) ||
        ''
      );
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
    const normalized = trimmed.includes('@')
      ? trimmed.split('@')[0].replace(/[._-]+/g, ' ')
      : trimmed;
    const parts = normalized.split(/\s+/).filter(Boolean);
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
