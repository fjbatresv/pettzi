import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PetEvent } from '@pettzi/domain-model';
import { EventsService, EventAttachment, EventDetailResponse } from '../../core/services/events.service';
import { PetsService } from '../../core/services/pets.service';
import { EventAttachmentPreviewDialogComponent } from './event-attachment-preview-dialog.component';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    TranslateModule,
  ],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.scss',
})
export class EventDetailComponent implements OnInit {
  private readonly events = inject(EventsService);
  private readonly pets = inject(PetsService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly weightUnitKey = 'pettzi.weightUnit';

  petId = '';
  eventId = '';
  event: PetEvent | null = null;
  attachments: EventAttachment[] = [];
  isLoading = true;
  errorMessage = '';
  petName = '';

  ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('petId') ?? '';
    this.eventId = this.route.snapshot.paramMap.get('eventId') ?? '';

    if (!this.petId || !this.eventId) {
      this.errorMessage = this.translate.instant('eventDetail.loadError');
      this.isLoading = false;
      return;
    }

    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        const list = pets ?? [];
        const match = list.find((pet) => pet.petId === this.petId);
        this.petName = match?.name ?? '';
      },
    });

    this.events.getPetEventDetail(this.petId, this.eventId).subscribe({
      next: (response: EventDetailResponse) => {
        this.event = response.event ?? null;
        this.attachments = response.attachments ?? [];
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.translate.instant('eventDetail.loadError');
        this.isLoading = false;
      },
    });
  }

  goBack() {
    if (this.petId) {
      void this.router.navigate(['/pets', this.petId]);
      return;
    }
    void this.router.navigate(['/home']);
  }

  getEventTypeLabel(eventType?: string) {
    switch (eventType) {
      case 'GROOMING':
        return this.translate.instant('dashboard.eventType.grooming');
      case 'VET_VISIT':
        return this.translate.instant('dashboard.eventType.vetVisit');
      case 'MEDICATION':
        return this.translate.instant('dashboard.eventType.medication');
      case 'WEIGHT':
        return this.translate.instant('dashboard.eventType.weight');
      case 'VACCINE':
        return this.translate.instant('dashboard.eventType.vaccine');
      case 'INCIDENT':
        return this.translate.instant('dashboard.eventType.incident');
      case 'WALK':
        return this.translate.instant('dashboard.eventType.walk');
      case 'FEEDING':
        return this.translate.instant('dashboard.eventType.feeding');
      case 'OTHER':
        return this.translate.instant('dashboard.eventType.other');
      default:
        return eventType || '';
    }
  }

  getEventIcon(eventType?: string) {
    switch (eventType) {
      case 'GROOMING':
        return 'content_cut';
      case 'VET_VISIT':
        return 'local_hospital';
      case 'MEDICATION':
        return 'medication';
      case 'WEIGHT':
        return 'monitor_weight';
      case 'VACCINE':
        return 'vaccines';
      case 'INCIDENT':
        return 'report';
      case 'WALK':
        return 'directions_walk';
      case 'FEEDING':
        return 'restaurant';
      default:
        return 'event_note';
    }
  }

  formatEventDateWithYear(value?: Date | string) {
    if (!value) {
      return '';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString(this.getLocale(), {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  getMedicationName(event: PetEvent) {
    const meta = this.getMetadata(event);
    const name =
      (meta['name'] as string) ||
      (meta['medicationName'] as string) ||
      (meta['medicineName'] as string) ||
      (meta['medicine'] as string) ||
      (meta['title'] as string) ||
      event.title ||
      '';
    return this.getValueOrUnknown(name);
  }

  getMedicationPeriodicity(event: PetEvent) {
    const meta = this.getMetadata(event);
    const periodicity = (meta['periodicity'] ?? {}) as Record<string, unknown>;
    const type = periodicity['type'];
    if (type === 'hours') {
      const everyHours = Number(periodicity['everyHours'] ?? 0);
      return this.translate
        .instant('medication.periodicityHours')
        .replace('X', String(everyHours || 1));
    }
    if (type === 'weekly') {
      const day = Number(periodicity['weekday'] ?? 0);
      const time = String(periodicity['time'] ?? '').trim();
      const dayLabel = this.getWeekdayLabel(day);
      return `${this.translate.instant('medication.periodicityWeekly')} · ${dayLabel}${
        time ? ` ${time}` : ''
      }`;
    }
    if (type === 'monthly') {
      const day = Number(periodicity['dayOfMonth'] ?? 1);
      const time = String(periodicity['time'] ?? '').trim();
      return `${this.translate.instant('medication.periodicityMonthly')} · ${day}${
        time ? ` ${time}` : ''
      }`;
    }
    const time = String(periodicity['time'] ?? '').trim();
    return `${this.translate.instant('medication.periodicityDaily')}${time ? ` ${time}` : ''}`;
  }

  getMedicationDose(event: PetEvent) {
    const meta = this.getMetadata(event);
    return this.getValueOrUnknown(meta['dose']);
  }

  getMedicationEndDate(event: PetEvent) {
    const meta = this.getMetadata(event);
    const indefinite = Boolean(meta['indefinite']);
    if (indefinite) {
      return this.translate.instant('medication.indefinite');
    }
    const endDate = meta['endDate'];
    if (!endDate) {
      return this.translate.instant('dashboard.unknown');
    }
    return this.formatEventDateWithYear(endDate as string);
  }

  getVetClinic(event: PetEvent) {
    const meta = this.getMetadata(event);
    return this.getValueOrUnknown(String(meta['clinic'] ?? ''));
  }

  getVetName(event: PetEvent) {
    const meta = this.getMetadata(event);
    return this.getValueOrUnknown(String(meta['veterinarian'] ?? ''));
  }

  getVetReason(event: PetEvent) {
    const meta = this.getMetadata(event);
    const reason =
      (meta['reason'] as string) ||
      (meta['visitReason'] as string) ||
      (meta['visitTitle'] as string) ||
      (meta['title'] as string) ||
      event.title ||
      '';
    return this.getValueOrUnknown(reason);
  }

  getVaccineName(event: PetEvent) {
    const meta = this.getMetadata(event);
    const name = (meta['name'] as string) || event.title || '';
    return this.getValueOrUnknown(name);
  }

  getVaccineBatch(event: PetEvent) {
    const meta = this.getMetadata(event);
    return this.getValueOrUnknown(String(meta['batchNumber'] ?? ''));
  }

  getVaccineClinic(event: PetEvent) {
    const meta = this.getMetadata(event);
    return this.getValueOrUnknown(String(meta['clinic'] ?? ''));
  }

  getVaccineVet(event: PetEvent) {
    const meta = this.getMetadata(event);
    return this.getValueOrUnknown(String(meta['veterinarian'] ?? ''));
  }

  getVaccineExpiry(event: PetEvent) {
    const meta = this.getMetadata(event);
    const expiry = meta['expiryDate'];
    if (!expiry) {
      return this.translate.instant('dashboard.unknown');
    }
    return this.formatEventDateWithYear(expiry as string);
  }

  getGroomingServices(event: PetEvent) {
    const meta = this.getMetadata(event);
    const services = Array.isArray(meta['services']) ? (meta['services'] as string[]) : [];
    if (!services.length) {
      return this.translate.instant('dashboard.unknown');
    }
    return services
      .map((service) => {
        const normalized = service.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        const label = this.translate.instant(`grooming.services.${normalized}`);
        return label.startsWith('grooming.services.') ? service : label;
      })
      .join(', ');
  }

  getWeightLabel(event: PetEvent) {
    const meta = this.getMetadata(event);
    const weightKg = Number(meta['weightKg']);
    if (!Number.isFinite(weightKg)) {
      return this.translate.instant('dashboard.unknown');
    }
    const preferredUnit = this.getPreferredWeightUnit();
    if (preferredUnit === 'lb') {
      return `${this.toLb(weightKg)} lb`;
    }
    return `${weightKg} kg`;
  }

  getObservationLabel(event: PetEvent) {
    return event.notes?.trim() || this.translate.instant('dashboard.noDetails');
  }

  getIncidentName(event: PetEvent) {
    const meta = this.getMetadata(event);
    const name = (meta['name'] as string) || event.title || '';
    return this.getValueOrUnknown(name);
  }

  getWalkDuration(event: PetEvent) {
    const meta = this.getMetadata(event);
    const minutes = Number(meta['durationMinutes']);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return this.translate.instant('dashboard.unknown');
    }
    return this.translate.instant('walks.durationValue', { minutes });
  }

  getWalkDistance(event: PetEvent) {
    const meta = this.getMetadata(event);
    const km = Number(meta['distanceKm']);
    if (!Number.isFinite(km) || km <= 0) {
      return this.translate.instant('dashboard.unknown');
    }
    return this.translate.instant('walks.distanceValue', { km });
  }

  getFeedingPrevious(event: PetEvent) {
    const meta = this.getMetadata(event);
    return this.getValueOrUnknown(meta['previousFood']);
  }

  getFeedingNew(event: PetEvent) {
    const meta = this.getMetadata(event);
    const food = (meta['newFood'] as string) || event.title || '';
    return this.getValueOrUnknown(food);
  }

  getFeedingPortion(event: PetEvent) {
    const meta = this.getMetadata(event);
    const portion = this.formatFeedingPortion(meta);
    return portion || this.getValueOrUnknown(meta['portion']);
  }

  getFeedingMeals(event: PetEvent) {
    const meta = this.getMetadata(event);
    const meals = Number(meta['mealTimes']);
    if (!Number.isFinite(meals) || meals <= 0) {
      return this.translate.instant('dashboard.unknown');
    }
    return this.translate.instant('feeding.mealTimesValue', { meals });
  }

  private formatFeedingPortion(meta: Record<string, unknown>) {
    const amount = String(meta['portionAmount'] ?? '').trim();
    const unit = String(meta['portionUnit'] ?? '').trim();
    if (!amount && !unit) {
      return '';
    }
    if (unit === 'gr') {
      return `${amount} ${this.translate.instant('feeding.unitGr')}`.trim();
    }
    if (unit === 'cup') {
      return `${amount} ${this.translate.instant('feeding.unitCup')}`.trim();
    }
    return `${amount} ${unit}`.trim();
  }

  openAttachment(attachment: EventAttachment) {
    if (!attachment.downloadUrl) {
      return;
    }
    if (attachment.isImage) {
      this.dialog.open(EventAttachmentPreviewDialogComponent, {
        panelClass: 'attachment-preview-dialog',
        data: {
          url: attachment.previewUrl || attachment.downloadUrl,
          name: attachment.fileName,
        },
      });
      return;
    }
    window.open(attachment.downloadUrl, '_blank', 'noopener');
  }

  private getMetadata(event: PetEvent) {
    const meta = event.metadata;
    if (!meta) {
      return {} as Record<string, unknown>;
    }
    if (typeof meta === 'string') {
      try {
        return JSON.parse(meta) as Record<string, unknown>;
      } catch {
        return {} as Record<string, unknown>;
      }
    }
    return meta as Record<string, unknown>;
  }

  getValueOrUnknown(value?: unknown) {
    if (value === null || value === undefined) {
      return this.translate.instant('dashboard.unknown');
    }
    const cleaned = typeof value === 'string' ? value.trim() : String(value);
    return cleaned || this.translate.instant('dashboard.unknown');
  }

  private getWeekdayLabel(dayIndex: number) {
    const keys = [
      'medication.weekdaySun',
      'medication.weekdayMon',
      'medication.weekdayTue',
      'medication.weekdayWed',
      'medication.weekdayThu',
      'medication.weekdayFri',
      'medication.weekdaySat',
    ];
    const key = keys[dayIndex] ?? keys[0];
    return this.translate.instant(key);
  }

  private getPreferredWeightUnit() {
    const stored = localStorage.getItem(this.weightUnitKey);
    return stored === 'lb' ? 'lb' : 'kg';
  }

  private toLb(valueKg: number) {
    const value = valueKg / 0.45359237;
    return Math.round(value * 10) / 10;
  }

  private getLocale() {
    return this.translate.currentLang || this.translate.defaultLang || 'es';
  }
}
