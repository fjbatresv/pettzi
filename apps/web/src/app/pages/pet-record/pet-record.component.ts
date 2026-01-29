import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { EventType, Pet, PetEvent } from '@pettzi/domain-model';
import { PetsService, SharedRecordResponse } from '../../core/services/pets.service';
import { LanguageToggleComponent } from '../../components/language-toggle/language-toggle.component';
import { CatalogsService, BreedItem, SpeciesItem } from '../../core/services/catalogs.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pet-record',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, MatIconModule, LanguageToggleComponent],
  templateUrl: './pet-record.component.html',
  styleUrl: './pet-record.component.scss',
})
export class PetRecordComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly pets = inject(PetsService);
  private readonly translate = inject(TranslateService);
  private readonly catalogs = inject(CatalogsService);
  private readonly subscriptions = new Subscription();

  token = '';
  password = '';
  requiresPassword = false;
  isSubmitting = false;
  isLoading = true;
  errorMessage = '';
  record: SharedRecordResponse | null = null;
  photoLoadError = false;
  speciesOptions: SpeciesItem[] = [];
  breeds: BreedItem[] = [];
  eventsCursor = '';
  hasMoreEvents = false;
  isLoadingMoreActivity = false;

  get hasRecord() {
    return !!this.record && !this.requiresPassword;
  }

  get pet(): Pet | null {
    return this.record?.pet ?? null;
  }

  get petPhotoUrl() {
    if (this.photoLoadError) {
      return '';
    }
    return this.record?.photoUrl ?? '';
  }

  get speciesLabel() {
    const raw = this.pet?.species;
    if (!raw) {
      return this.translate.instant('dashboard.unknown');
    }
    const normalized = raw.toUpperCase();
    const match = this.speciesOptions.find(
      (item) => item.code?.toUpperCase() === normalized
    );
    return match?.label || raw;
  }

  get breedLabel() {
    const raw = this.pet?.breed;
    if (!raw) {
      return this.translate.instant('dashboard.unknown');
    }
    const normalized = raw.toUpperCase();
    const match = this.breeds.find(
      (item) => item.code?.toUpperCase() === normalized
    );
    return match?.label || raw;
  }

  get sexLabel() {
    const raw = this.pet?.sex;
    if (!raw) {
      return this.translate.instant('dashboard.unknown');
    }
    const normalized = raw.toUpperCase();
    if (normalized === 'MALE' || normalized === 'M') {
      return this.translate.instant('petRecord.sexMale');
    }
    if (normalized === 'FEMALE' || normalized === 'F') {
      return this.translate.instant('petRecord.sexFemale');
    }
    return raw;
  }

  get chipId() {
    const notes = this.pet?.notes;
    if (!notes) {
      return '';
    }
    const chipPrefix = 'Chip: ';
    if (notes.startsWith(chipPrefix)) {
      const rest = notes.slice(chipPrefix.length);
      const [chipLine] = rest.split('\n');
      return chipLine.trim();
    }
    return '';
  }

  get healthIndex() {
    const value = this.pet?.healthIndex;
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }
    return Math.min(5, Math.max(0, value));
  }

  get showHealthStatus() {
    return this.pet?.healthIndex !== null && this.pet?.healthIndex !== undefined;
  }

  get activityLog(): PetEvent[] {
    return this.record?.events ?? [];
  }

  get activityEmpty() {
    return this.hasRecord && this.activityLog.length === 0;
  }

  get displayedActivityLog() {
    return this.activityLog;
  }

  get canLoadMoreActivity() {
    return this.hasMoreEvents;
  }

  get birthDateLabel() {
    if (!this.pet?.birthDate) {
      return '';
    }
    const date = new Date(this.pet.birthDate as unknown as string);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString(this.getLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.isLoading = false;
      this.errorMessage = this.translate.instant('petRecord.missingToken');
      return;
    }
    this.loadSpecies();
    this.subscriptions.add(
      this.translate.onLangChange.subscribe(() => {
        this.loadSpecies();
        if (this.pet?.species) {
          this.loadBreeds(this.pet.species);
        }
      })
    );
    this.fetchRecord();
  }

  submitPassword() {
    if (!this.password || this.isSubmitting) {
      return;
    }
    this.fetchRecord({ password: this.password });
  }

  private fetchRecord(options?: { password?: string; cursor?: string; limit?: number }) {
    if (!this.token) {
      return;
    }
    this.isSubmitting = true;
    this.isLoading = !options?.cursor;
    this.errorMessage = '';

    this.pets
      .getSharedRecord(this.token, {
        password: options?.password,
        cursor: options?.cursor,
        limit: options?.limit ?? 5,
      })
      .subscribe({
      next: (response) => {
        if (response?.requiresPassword) {
          this.requiresPassword = true;
          this.record = null;
          this.photoLoadError = false;
          this.eventsCursor = '';
          this.hasMoreEvents = false;
        } else {
          this.requiresPassword = false;
          if (options?.cursor && this.record) {
            const current = this.record.events ?? [];
            const nextEvents = response.events ?? [];
            this.record = { ...response, events: [...current, ...nextEvents] };
          } else {
            this.record = response;
          }
          this.photoLoadError = false;
          this.eventsCursor = response.nextCursor ?? '';
          this.hasMoreEvents = Boolean(response.nextCursor);
          if (response.pet?.species) {
            this.loadBreeds(response.pet.species);
          }
        }
        this.isLoading = false;
        this.isSubmitting = false;
        if (options?.cursor) {
          this.isLoadingMoreActivity = false;
        }
      },
      error: (err) => {
        const apiMessage = err?.error?.message;
        if (apiMessage === 'Invalid password') {
          this.errorMessage = this.translate.instant('petRecord.invalidPassword');
          this.requiresPassword = true;
        } else if (apiMessage === 'Shared record not found' || apiMessage === 'Shared record expired') {
          this.errorMessage = this.translate.instant('petRecord.invalidToken');
          this.requiresPassword = false;
        } else {
          this.errorMessage = this.translate.instant('petRecord.errorDefault');
        }
        this.isLoading = false;
        this.isSubmitting = false;
        if (options?.cursor) {
          this.isLoadingMoreActivity = false;
        }
      },
    });
  }

  getEventTypeLabel(eventType?: EventType) {
    switch (eventType) {
      case EventType.GROOMING:
        return this.translate.instant('dashboard.eventType.grooming');
      case EventType.VET_VISIT:
        return this.translate.instant('dashboard.eventType.vetVisit');
      case EventType.MEDICATION:
        return this.translate.instant('dashboard.eventType.medication');
      case EventType.WEIGHT:
        return this.translate.instant('dashboard.eventType.weight');
      case EventType.VACCINE:
        return this.translate.instant('dashboard.eventType.vaccine');
      case EventType.INCIDENT:
        return this.translate.instant('dashboard.eventType.incident');
      case EventType.WALK:
        return this.translate.instant('dashboard.eventType.walk');
      case EventType.FEEDING:
        return this.translate.instant('dashboard.eventType.feeding');
      case EventType.OTHER:
        return this.translate.instant('dashboard.eventType.other');
      default:
        return eventType || '';
    }
  }

  getEventDescription(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const title =
      (meta['title'] as string) ||
      (meta['name'] as string) ||
      (meta['medicationName'] as string) ||
      (meta['medicineName'] as string) ||
      (meta['vaccineName'] as string) ||
      event.title ||
      '';

    switch (event.eventType) {
      case EventType.WEIGHT: {
        const weightLabel = this.getWeightLabel(meta);
        if (weightLabel) {
          return title ? `${title} — ${weightLabel}` : weightLabel;
        }
        break;
      }
      case EventType.GROOMING: {
        const servicesLabel = this.getGroomingServicesLabel(meta);
        if (servicesLabel) {
          return title ? `${title} — ${servicesLabel}` : servicesLabel;
        }
        break;
      }
      case EventType.VACCINE: {
        const batchLabel = this.getVaccineBatchLabel(meta);
        if (batchLabel) {
          return title ? `${title} — ${batchLabel}` : batchLabel;
        }
        break;
      }
      case EventType.MEDICATION: {
        const notes = event.notes?.trim() || (meta['description'] as string) || '';
        if (notes) {
          return title ? `${title} — ${notes}` : notes;
        }
        break;
      }
      case EventType.VET_VISIT: {
        const reason = (meta['reason'] as string) || title;
        const notes = event.notes?.trim() || (meta['description'] as string) || '';
        if (reason && notes) {
          return `${reason} — ${notes}`;
        }
        if (reason) {
          return reason;
        }
        if (notes) {
          return notes;
        }
        break;
      }
      case EventType.INCIDENT: {
        const notes = event.notes?.trim() || (meta['description'] as string) || '';
        if (title && notes) {
          return `${title} — ${notes}`;
        }
        if (notes) {
          return notes;
        }
        break;
      }
      case EventType.WALK: {
        const minutes = Number(meta['durationMinutes']);
        const distance = Number(meta['distanceKm']);
        const durationLabel = Number.isFinite(minutes)
          ? this.translate.instant('walks.durationValue', { minutes })
          : '';
        const distanceLabel = Number.isFinite(distance)
          ? this.translate.instant('walks.distanceValue', { km: distance })
          : '';
        const detail = [durationLabel, distanceLabel].filter((value) => value).join(' · ');
        if (title && detail) {
          return `${title} — ${detail}`;
        }
        return detail || title;
      }
      case EventType.FEEDING: {
        const newFood = (meta['newFood'] as string) || event.title || '';
        const portion = (meta['portion'] as string) || '';
        if (newFood && portion) {
          return `${newFood} — ${portion}`;
        }
        return newFood || portion || title;
      }
      default:
        break;
    }

    const detail =
      (meta['description'] as string) ||
      (meta['notes'] as string) ||
      (meta['message'] as string) ||
      event.notes ||
      '';
    if (title && detail) {
      return `${title} — ${detail}`;
    }
    return title || detail || this.translate.instant('dashboard.noDetails');
  }

  getEventFacility(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const clinic =
      (meta['clinic'] as string) ||
      (meta['vetClinic'] as string) ||
      (meta['vet'] as string) ||
      (meta['facility'] as string) ||
      '';
    const groomer = (meta['groomer'] as string) || '';
    if (event.eventType === 'GROOMING') {
      const combo = [clinic, groomer].filter((value) => value && value.trim());
      if (combo.length) {
        return combo.join(' · ');
      }
    }
    const facility = clinic || groomer;
    return facility || this.translate.instant('dashboard.unknown');
  }

  getHealthBones() {
    return Array.from({ length: 5 });
  }

  onPhotoError() {
    this.photoLoadError = true;
  }

  loadMoreActivity() {
    if (!this.hasMoreEvents) {
      return;
    }
    this.isLoadingMoreActivity = true;
    this.fetchRecord({
      cursor: this.eventsCursor,
      limit: 10,
      password: this.password || undefined,
    });
  }

  private getWeightLabel(meta: Record<string, unknown>) {
    const weightKg = Number(meta['weightKg']);
    if (!Number.isFinite(weightKg)) {
      return '';
    }
    const unit = String(meta['unit'] ?? 'kg');
    if (unit === 'lb') {
      const value = this.toLb(weightKg);
      return `${this.translate.instant('petRecord.weightNew')} ${value} lb`;
    }
    return `${this.translate.instant('petRecord.weightNew')} ${weightKg} kg`;
  }

  private getGroomingServicesLabel(meta: Record<string, unknown>) {
    const services = Array.isArray(meta['services']) ? (meta['services'] as string[]) : [];
    if (!services.length) {
      return '';
    }
    const labels = services.map((service) => {
      switch (service) {
        case 'full-bath':
          return this.translate.instant('grooming.services.fullBath');
        case 'haircut':
          return this.translate.instant('grooming.services.haircut');
        case 'nails':
          return this.translate.instant('grooming.services.nails');
        default:
          return service;
      }
    });
    return `${this.translate.instant('petRecord.services')}: ${labels.join(', ')}`;
  }

  private getVaccineBatchLabel(meta: Record<string, unknown>) {
    const batch = String(meta['batchNumber'] ?? '').trim();
    if (!batch) {
      return '';
    }
    return `${this.translate.instant('petRecord.batch')}: ${batch}`;
  }

  private toLb(valueKg: number) {
    const value = valueKg / 0.45359237;
    return Math.round(value * 10) / 10;
  }

  private loadBreeds(speciesCode: string) {
    this.catalogs.getBreeds(speciesCode).subscribe({
      next: ({ breeds }) => {
        this.breeds = breeds ?? [];
      },
      error: () => {
        this.breeds = [];
      },
    });
  }

  private loadSpecies() {
    this.catalogs.getSpecies().subscribe({
      next: ({ species }) => {
        this.speciesOptions = species ?? [];
      },
      error: () => {
        this.speciesOptions = [];
      },
    });
  }

  private getLocale() {
    return this.translate.currentLang || this.translate.defaultLang || 'es';
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}
