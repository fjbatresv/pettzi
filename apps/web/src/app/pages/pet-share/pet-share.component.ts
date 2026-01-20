import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Pet } from '@pettzi/domain-model';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { BreedItem, CatalogsService, SpeciesItem } from '../../core/services/catalogs.service';
import { OwnerRole, OwnersService, PetOwner } from '../../core/services/owners.service';
import { PetsService } from '../../core/services/pets.service';
import { UploadsService } from '../../core/services/uploads.service';

interface OwnerView {
  ownerId: string;
  role: OwnerRole;
  name: string;
  initials: string;
  photoUrl?: string;
  canRemove: boolean;
  email?: string;
}

@Component({
  selector: 'app-pet-share',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslateModule,
  ],
  templateUrl: './pet-share.component.html',
  styleUrl: './pet-share.component.scss',
})
export class PetShareComponent implements OnInit {
  private readonly pets = inject(PetsService);
  private readonly uploads = inject(UploadsService);
  private readonly catalogs = inject(CatalogsService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly owners = inject(OwnersService);
  private readonly activePetKey = 'pettzi.activePetId';

  pet: Pet | null = null;
  petPhotoUrl = '';
  speciesOptions: SpeciesItem[] = [];
  breedOptions: BreedItem[] = [];

  ownersList: PetOwner[] = [];
  primaryOwner: OwnerView | null = null;
  coOwners: OwnerView[] = [];
  inviteEmail = '';
  inviteSent = false;
  inviteError = '';
  isSending = false;
  userName = '';
  userInitials = '??';
  userPhotoUrl = '';
  currentOwnerId = '';
  canManageOwners = false;

  ngOnInit() {
    void this.loadUserProfile();
    this.catalogs.getSpecies().subscribe({
      next: ({ species }) => {
        this.speciesOptions = species ?? [];
        if (this.pet?.species) {
          this.loadBreeds(this.pet.species);
        }
      },
    });
    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        const list = pets ?? [];
        if (list.length === 0) {
          return;
        }
        const activeId = localStorage.getItem(this.activePetKey);
        this.pet = list.find((item) => item.petId === activeId) ?? list[0] ?? null;
        const photoKey = this.pet?.photoThumbnailKey ?? this.pet?.photoKey;
        if (this.pet?.petId && photoKey) {
          this.loadPhoto(this.pet.petId, photoKey);
        }
        if (this.pet?.species) {
          this.loadBreeds(this.pet.species);
        }
        if (this.pet?.petId) {
          this.loadOwners(this.pet.petId);
        }
      },
    });
  }

  get petNameLabel() {
    return this.pet?.name || this.translate.instant('dashboard.petFallback');
  }

  get petInitial() {
    const name = this.pet?.name?.trim();
    if (name) {
      return name[0]?.toUpperCase();
    }
    return this.translate.instant('dashboard.petInitial');
  }

  get speciesLabel() {
    if (!this.pet?.species) {
      return '';
    }
    const match = this.speciesOptions.find((item) => item.code === this.pet?.species);
    return match?.label || this.pet.species;
  }

  get breedLabel() {
    if (!this.pet?.breed) {
      return '';
    }
    const match = this.breedOptions.find((item) => item.code === this.pet?.breed);
    return match?.label || this.pet.breed;
  }

  get ageLabel() {
    if (!this.pet?.birthDate) {
      return '';
    }

    const birth =
      this.pet.birthDate instanceof Date
        ? this.pet.birthDate
        : new Date(this.pet.birthDate as unknown as string);
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

    if (years < 0) {
      return '';
    }

    if (years > 0) {
      return this.translate.instant('dashboard.yearsOld', { count: years });
    }

    return this.translate.instant('dashboard.monthsOld', { count: Math.max(months, 0) });
  }

  get canSendInvite() {
    const email = this.inviteEmail.trim();
    return !!email && this.isValidEmail(email);
  }

  sendInvite() {
    this.inviteError = '';
    this.inviteSent = false;
    const email = this.inviteEmail.trim();
    if (!this.isValidEmail(email)) {
      this.inviteError = this.translate.instant('sharePet.inviteError');
      return;
    }
    if (!this.pet?.petId) {
      this.inviteError = this.translate.instant('sharePet.inviteFailed');
      return;
    }
    this.isSending = true;
    this.owners.invitePetOwner(this.pet.petId, email).subscribe({
      next: () => {
        this.inviteSent = true;
        this.inviteEmail = '';
        this.isSending = false;
      },
      error: () => {
        this.inviteError = this.translate.instant('sharePet.inviteFailed');
        this.isSending = false;
      },
    });
  }

  removeOwner(ownerId: string) {
    if (!this.pet?.petId || !ownerId) {
      return;
    }
    this.owners.removePetOwner(this.pet.petId, ownerId).subscribe({
      next: () => {
        this.loadOwners(this.pet!.petId);
      },
    });
  }

  private loadPhoto(petId: string, fileKey: string) {
    this.uploads.generateDownloadUrl(petId, fileKey).subscribe({
      next: ({ downloadUrl }) => {
        this.petPhotoUrl = downloadUrl;
      },
    });
  }

  private loadOwners(petId: string) {
    this.owners.listPetOwners(petId).subscribe({
      next: ({ owners }) => {
        this.ownersList = owners ?? [];
        this.buildOwnerViews();
      },
    });
  }

  private buildOwnerViews() {
    if (!this.ownersList.length) {
      this.primaryOwner = null;
      this.coOwners = [];
      return;
    }

    const currentOwner = this.currentOwnerId
      ? this.ownersList.find((owner) => owner.ownerId === this.currentOwnerId)
      : undefined;
    this.canManageOwners = currentOwner?.role === 'PRIMARY';

    const mapped = this.ownersList.map((owner) => {
      const isCurrent = owner.ownerId === this.currentOwnerId;
      const profileName = owner.profile?.fullName?.trim() || owner.profile?.email?.trim();
      const name = isCurrent
        ? this.userName || profileName || this.translate.instant('sharePet.you')
        : profileName || owner.ownerId;
      const initials = isCurrent
        ? this.userInitials
        : this.buildAvatarLabel(name);
      const photoUrl = isCurrent ? this.userPhotoUrl : undefined;
      return {
        ownerId: owner.ownerId,
        role: owner.role,
        name,
        initials,
        photoUrl,
        canRemove: this.canManageOwners && owner.role === 'SECONDARY',
        email: owner.profile?.email,
      };
    });

    this.primaryOwner = mapped.find((owner) => owner.role === 'PRIMARY') ?? null;
    this.coOwners = mapped.filter((owner) => owner.role === 'SECONDARY');
  }

  private async loadUserProfile() {
    try {
      const profile = await firstValueFrom(this.auth.getUserProfile());
      const name =
        profile.fullName?.trim() ||
        [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
      this.userName = name;
      this.userInitials = this.buildAvatarLabel(name);
      const photoKey = profile.profilePhotoKey?.trim();
      if (photoKey) {
        this.loadProfilePhoto(photoKey);
      }
      await this.loadCurrentOwnerId();
      this.buildOwnerViews();
      return;
    } catch {
      // fallback to token parsing below
    }

    const name = await this.getUserNameFromToken();
    this.userName = name;
    this.userInitials = this.buildAvatarLabel(name);
    await this.loadCurrentOwnerId();
    this.buildOwnerViews();
  }

  private async loadCurrentOwnerId() {
    const token = await this.auth.getIdToken();
    if (!token) {
      this.currentOwnerId = '';
      return;
    }
    try {
      const payload = this.getTokenPayload(token);
      this.currentOwnerId = this.getStringField(payload, [
        'email',
        'username',
        'cognito:username',
        'sub',
      ]);
    } catch {
      this.currentOwnerId = '';
    }
  }

  private loadProfilePhoto(fileKey: string) {
    this.uploads.generateProfileDownloadUrl(fileKey).subscribe({
      next: ({ downloadUrl }) => {
        this.userPhotoUrl = downloadUrl;
        this.buildOwnerViews();
      },
    });
  }

  private async getUserNameFromToken() {
    const token = await this.auth.getIdToken();
    if (!token) {
      return '';
    }
    try {
      const payload = this.getTokenPayload(token);
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

  private getTokenPayload(token: string) {
    const parts = token.split('.');
    if (parts.length < 2) {
      return {} as Record<string, unknown>;
    }
    return JSON.parse(this.decodeBase64Url(parts[1])) as Record<string, unknown>;
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
      return this.translate.instant('sharePet.you').slice(0, 2).toUpperCase();
    }
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
    }
    return (parts[0] ?? '').slice(0, 2).toUpperCase();
  }

  private loadBreeds(speciesCode: string) {
    this.catalogs.getBreeds(speciesCode).subscribe({
      next: ({ breeds }) => {
        this.breedOptions = breeds ?? [];
      },
      error: () => {
        this.breedOptions = [];
      },
    });
  }

  private isValidEmail(value: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
