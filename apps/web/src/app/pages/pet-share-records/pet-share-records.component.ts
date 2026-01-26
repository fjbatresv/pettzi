import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EventType, Pet } from '@pettzi/domain-model';
import { firstValueFrom } from 'rxjs';
import { BreedItem, CatalogsService, SpeciesItem } from '../../core/services/catalogs.service';
import {
  CreateSharedRecordResponse,
  PetsService,
  SharedRecordSummary,
} from '../../core/services/pets.service';
import { UploadsService } from '../../core/services/uploads.service';

interface RecordView extends SharedRecordSummary {
  shareUrl: string;
  isExpired: boolean;
  isDeleting?: boolean;
}

@Component({
  selector: 'app-pet-share-records',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    TranslateModule,
  ],
  templateUrl: './pet-share-records.component.html',
  styleUrl: './pet-share-records.component.scss',
})
export class PetShareRecordsComponent implements OnInit {
  private readonly pets = inject(PetsService);
  private readonly uploads = inject(UploadsService);
  private readonly catalogs = inject(CatalogsService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly activePetKey = 'pettzi.activePetId';

  pet: Pet | null = null;
  petId = '';
  petPhotoUrl = '';
  speciesOptions: SpeciesItem[] = [];
  breedOptions: BreedItem[] = [];

  readonly expirationOptions = [
    { value: '24h', label: 'shareRecord.expiration24h' },
    { value: '3d', label: 'shareRecord.expiration3d' },
    { value: '1w', label: 'shareRecord.expiration1w' },
    { value: '1m', label: 'shareRecord.expiration1m' },
  ] as const;

  readonly recordOptions = [
    { type: EventType.MEDICATION, label: 'dashboard.activityMedication' },
    { type: EventType.GROOMING, label: 'dashboard.activityGrooming' },
    { type: EventType.VET_VISIT, label: 'dashboard.activityVetVisit' },
    { type: EventType.VACCINE, label: 'dashboard.activityVaccine' },
    { type: EventType.WEIGHT, label: 'dashboard.activityWeight' },
  ] as const;

  selectedTypes = new Set<EventType>(this.recordOptions.map((option) => option.type));
  expiration: '24h' | '3d' | '1w' | '1m' = '24h';
  password = '';

  records: RecordView[] = [];
  isLoadingRecords = false;
  isSubmitting = false;
  statusMessage = '';
  statusTone: 'success' | 'error' | '' = '';
  confirmDeleteToken = '';
  copyingToken = '';

  ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('petId') ?? '';
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
        const targetId = this.petId || activeId || '';
        this.pet = targetId
          ? list.find((item) => item.petId === targetId) ?? list[0] ?? null
          : list[0] ?? null;
        if (this.pet?.petId) {
          this.petId = this.pet.petId;
          localStorage.setItem(this.activePetKey, this.pet.petId);
          this.loadRecords(this.pet.petId);
        }
        const photoKey = this.pet?.photoThumbnailKey ?? this.pet?.photoKey;
        if (this.pet?.petId && photoKey) {
          this.loadPhoto(this.pet.petId, photoKey);
        }
        if (this.pet?.species) {
          this.loadBreeds(this.pet.species);
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

  get canSubmit() {
    return !this.isSubmitting && this.selectedTypes.size > 0;
  }

  toggleType(type: EventType, selected: boolean) {
    if (selected) {
      this.selectedTypes.add(type);
    } else {
      this.selectedTypes.delete(type);
    }
  }

  async createLink() {
    if (!this.canSubmit || !this.petId) {
      return;
    }

    this.isSubmitting = true;
    this.statusMessage = '';
    this.statusTone = '';

    try {
      const response = await firstValueFrom(
        this.pets.createSharedRecord(this.petId, {
          items: Array.from(this.selectedTypes),
          expiresIn: this.expiration,
          password: this.password.trim() || undefined,
        })
      );
      const record = this.buildRecordView(response);
      this.records = [record, ...this.records];
      this.password = '';
      await this.copyLink(record);
    } catch {
      this.statusMessage = this.translate.instant('shareRecord.copyError');
      this.statusTone = 'error';
    } finally {
      this.isSubmitting = false;
    }
  }

  async copyLink(record: RecordView, input?: HTMLInputElement | null) {
    if (!record?.shareUrl) {
      return;
    }
    this.copyingToken = record.token;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(record.shareUrl);
        this.statusMessage = this.translate.instant('shareRecord.copySuccess');
        this.statusTone = 'success';
      } else {
        this.selectLink(undefined, input);
        const copied = document.execCommand?.('copy');
        this.statusMessage = copied
          ? this.translate.instant('shareRecord.copySuccess')
          : this.translate.instant('shareRecord.copyManual');
        this.statusTone = copied ? 'success' : '';
      }
    } catch {
      this.statusMessage = this.translate.instant('shareRecord.copyManual');
      this.statusTone = '';
    } finally {
      this.copyingToken = '';
    }
  }

  selectLink(event?: Event, input?: HTMLInputElement | null) {
    if (event) {
      event.preventDefault();
    }
    if (!input) {
      return;
    }
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
  }

  startDelete(token: string) {
    this.confirmDeleteToken = token;
  }

  cancelDelete() {
    this.confirmDeleteToken = '';
  }

  deleteLink(record: RecordView) {
    if (!this.petId || record.isDeleting) {
      return;
    }
    record.isDeleting = true;
    this.statusMessage = '';
    this.statusTone = '';
    this.pets.deleteSharedRecord(this.petId, record.token).subscribe({
      next: () => {
        this.records = this.records.filter((item) => item.token !== record.token);
        this.confirmDeleteToken = '';
        this.statusMessage = this.translate.instant('shareRecord.deleteSuccess');
        this.statusTone = 'success';
      },
      error: () => {
        record.isDeleting = false;
        this.statusMessage = this.translate.instant('shareRecord.deleteError');
        this.statusTone = 'error';
      },
    });
  }

  formatDate(value?: string) {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString(this.getLocale(), {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  isExpired(value?: string) {
    if (!value) {
      return false;
    }
    return new Date(value).getTime() <= Date.now();
  }

  getRecordLabel(type: EventType) {
    const match = this.recordOptions.find((option) => option.type === type);
    return match?.label ?? type;
  }

  private loadRecords(petId: string) {
    this.isLoadingRecords = true;
    this.pets.listSharedRecords(petId).subscribe({
      next: ({ records }) => {
        this.records = (records ?? []).map((record) => this.buildRecordView(record));
        this.isLoadingRecords = false;
      },
      error: () => {
        this.records = [];
        this.isLoadingRecords = false;
      },
    });
  }

  private buildRecordView(record: SharedRecordSummary | CreateSharedRecordResponse): RecordView {
    const shareUrl = `${window.location.origin}/pet-record?token=${record.token}`;
    const expiresAt = record.expiresAt;
    const createdAt =
      'createdAt' in record ? record.createdAt : new Date().toISOString();
    return {
      ...record,
      ownerId: 'ownerId' in record ? record.ownerId : undefined,
      createdAt,
      expiresAt,
      shareUrl,
      isExpired: this.isExpired(expiresAt),
    };
  }

  private loadPhoto(petId: string, fileKey: string) {
    this.uploads.generateDownloadUrl(petId, fileKey).subscribe({
      next: ({ downloadUrl }) => {
        this.petPhotoUrl = downloadUrl;
      },
      error: () => {
        this.petPhotoUrl = '';
      },
    });
  }

  private loadBreeds(species: string) {
    this.catalogs.getBreeds(species).subscribe({
      next: ({ breeds }) => {
        this.breedOptions = breeds ?? [];
      },
      error: () => {
        this.breedOptions = [];
      },
    });
  }

  private getLocale() {
    return this.translate.currentLang || this.translate.defaultLang || 'es';
  }
}
