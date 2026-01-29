import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Pet, PetEvent, PetReminder } from '@pettzi/domain-model';
import { PetsService } from '../../core/services/pets.service';
import { UploadsService } from '../../core/services/uploads.service';
import { EventsService } from '../../core/services/events.service';
import { RemindersService } from '../../core/services/reminders.service';
import { BreedItem, CatalogsService, SpeciesItem } from '../../core/services/catalogs.service';
import { ReminderDialogComponent, ReminderDialogResult } from './reminder-dialog.component';
import { DeleteActivityDialogComponent } from './delete-activity-dialog.component';
import { OwnersService, PetOwner } from '../../core/services/owners.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard-pet',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    TranslateModule,
  ],
  templateUrl: './dashboard-pet.component.html',
  styleUrl: './dashboard-pet.component.scss',
})
export class DashboardPetComponent implements OnInit {
  private readonly pets = inject(PetsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly uploads = inject(UploadsService);
  private readonly events = inject(EventsService);
  private readonly reminders = inject(RemindersService);
  private readonly catalogs = inject(CatalogsService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly owners = inject(OwnersService);
  private readonly auth = inject(AuthService);
  private readonly weightUnitKey = 'pettzi.weightUnit';
  private readonly activePetKey = 'pettzi.activePetId';

  pet: Pet | null = null;
  petId = '';
  petPhotoUrl = '';
  speciesOptions: SpeciesItem[] = [];
  breedOptions: BreedItem[] = [];
  activityLog: PetEvent[] = [];
  remindersList: PetReminder[] = [];
  ownersList: PetOwner[] = [];
  eventsCursor = '';
  hasMoreEvents = false;
  isLoadingMoreActivity = false;
  hasCoOwners = false;
  currentOwnerId = '';
  showPetMenu = false;
  canManagePet = false;
  deletingEventIds = new Set<string>();
  deletingReminderIds = new Set<string>();
  selectedEventTypes = new Set<string>([
    'MEDICATION',
    'GROOMING',
    'VET_VISIT',
    'VACCINE',
    'WEIGHT',
    'INCIDENT',
    'WALK',
    'FEEDING',
  ]);
  readonly activityFilterOptions = [
    'MEDICATION',
    'GROOMING',
    'VET_VISIT',
    'VACCINE',
    'WEIGHT',
    'INCIDENT',
    'WALK',
    'FEEDING',
  ];

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
          void this.router.navigate(['/pets/new']);
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
        }
        const photoKey = this.pet?.photoThumbnailKey ?? this.pet?.photoKey;
        if (this.pet?.petId && photoKey) {
          this.loadPhoto(this.pet.petId, photoKey);
        }
        if (this.pet?.petId) {
          this.loadEvents(this.pet.petId);
          this.loadReminders(this.pet.petId);
          this.loadOwners(this.pet.petId);
        }
        if (this.pet?.species) {
          this.loadBreeds(this.pet.species);
        }
      },
      error: () => {
        void this.router.navigate(['/']);
      },
    });
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

  get weightLabel() {
    if (this.pet?.weightKg === undefined || this.pet?.weightKg === null) {
      return '--';
    }
    const unit = this.getPreferredWeightUnit();
    if (unit === 'lb') {
      return `${this.toLb(this.pet.weightKg)} lb`;
    }
    return `${this.pet.weightKg} kg`;
  }

  get nextVaccineDateLabel() {
    const reminder = this.getNextVaccineReminder();
    if (!reminder?.dueDate) {
      return '';
    }
    return this.formatReminderDate(reminder.dueDate);
  }

  get nextVaccineSubtitle() {
    const reminder = this.getNextVaccineReminder();
    if (!reminder) {
      return this.translate.instant('dashboard.scheduleNextVaccine');
    }
    return reminder.message || this.translate.instant('dashboard.upcomingVaccine');
  }

  get healthScoreLabel() {
    return `${this.healthIndex}/5`;
  }

  get healthScoreSubtitle() {
    return this.healthIndex > 0
      ? this.translate.instant('dashboard.healthKeepUp')
      : this.translate.instant('dashboard.healthAddData');
  }

  get showHealthStatus() {
    return this.healthIndex > 0;
  }

  get healthIndex() {
    const value = this.pet?.healthIndex;
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }
    return Math.min(5, Math.max(0, value));
  }

  get hasHealthIndexData() {
    return this.pet?.healthIndex !== null && this.pet?.healthIndex !== undefined;
  }

  get lastVetLabel() {
    const vetEvent = this.activityLog.find((event) => event.eventType === 'VET_VISIT');
    if (!vetEvent?.eventDate) {
      return '';
    }
    const dateLabel = this.formatEventDate(vetEvent.eventDate);
    if (!dateLabel) {
      return this.translate.instant('dashboard.lastVet');
    }
    return this.translate.instant('dashboard.lastVetWithDate', { date: dateLabel });
  }

  get lastVaccineLabel() {
    const vaccineEvent = this.activityLog.find((event) => event.eventType === 'VACCINE');
    if (!vaccineEvent?.eventDate) {
      return '';
    }
    const dateLabel = this.formatEventDate(vaccineEvent.eventDate);
    if (!dateLabel) {
      return this.translate.instant('dashboard.lastVaccine');
    }
    return this.translate.instant('dashboard.lastVaccineWithDate', { date: dateLabel });
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

  getValueOrUnknown(value?: string) {
    const cleaned = value?.trim();
    return cleaned || this.translate.instant('dashboard.unknown');
  }

  getMedicationName(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
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
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
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

  getMedicationEndDate(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const indefinite = Boolean(meta['indefinite']);
    if (indefinite) {
      return this.translate.instant('medication.indefinite');
    }
    const endDate = meta['endDate'];
    if (!endDate) {
      return this.translate.instant('dashboard.unknown');
    }
    return this.formatEventDate(endDate as string);
  }

  getActivityStatus(event: PetEvent) {
    if (event.eventType === 'MEDICATION') {
      const meta = (event.metadata ?? {}) as Record<string, unknown>;
      const indefinite = Boolean(meta['indefinite']);
      const endDate = meta['endDate'];
      if (indefinite || !endDate) {
        return { key: 'dashboard.statusInProgress', className: 'status-progress' };
      }
      const end = new Date(endDate as string);
      if (Number.isNaN(end.getTime())) {
        return { key: 'dashboard.statusInProgress', className: 'status-progress' };
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return end.getTime() >= today.getTime()
        ? { key: 'dashboard.statusInProgress', className: 'status-progress' }
        : { key: 'dashboard.statusCompleted', className: 'status-complete' };
    }
    return { key: 'dashboard.statusCompleted', className: 'status-complete' };
  }

  getVetClinic(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    return this.getValueOrUnknown(String(meta['clinic'] ?? ''));
  }

  getVetName(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    return this.getValueOrUnknown(String(meta['veterinarian'] ?? ''));
  }

  getVetReason(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
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
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const name =
      (meta['name'] as string) ||
      event.title ||
      '';
    return this.getValueOrUnknown(name);
  }

  getVaccineBatch(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    return this.getValueOrUnknown(String(meta['batchNumber'] ?? ''));
  }

  getVaccineClinic(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    return this.getValueOrUnknown(String(meta['clinic'] ?? ''));
  }

  getVaccineVet(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    return this.getValueOrUnknown(String(meta['veterinarian'] ?? ''));
  }

  getVaccineExpiry(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const expiry = meta['expiryDate'];
    if (!expiry) {
      return this.translate.instant('dashboard.unknown');
    }
    const label = this.formatEventDateWithYear(expiry as string);
    return label;
  }

  isVaccineExpired(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const expiry = meta['expiryDate'];
    if (!expiry) {
      return false;
    }
    const expiryDate = new Date(expiry as string);
    if (Number.isNaN(expiryDate.getTime())) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    return expiryDate.getTime() < today.getTime();
  }

  getGroomingServices(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
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

  getGroomingClinic(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    return this.getValueOrUnknown(String(meta['clinic'] ?? ''));
  }

  getGroomingGroomer(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    return this.getValueOrUnknown(String(meta['groomer'] ?? ''));
  }

  getIncidentName(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const name = (meta['name'] as string) || event.title || '';
    return this.getValueOrUnknown(name);
  }

  getWalkDuration(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const minutes = Number(meta['durationMinutes']);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return this.translate.instant('dashboard.unknown');
    }
    return this.translate.instant('walks.durationValue', { minutes });
  }

  getWalkDistance(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const km = Number(meta['distanceKm']);
    if (!Number.isFinite(km) || km <= 0) {
      return this.translate.instant('dashboard.unknown');
    }
    return this.translate.instant('walks.distanceValue', { km });
  }

  getFeedingPrevious(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    return this.getValueOrUnknown(meta['previousFood'] as string);
  }

  getFeedingNew(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const food = (meta['newFood'] as string) || event.title || '';
    return this.getValueOrUnknown(food);
  }

  getFeedingPortion(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const portion = this.formatFeedingPortion(meta);
    return portion || this.getValueOrUnknown(meta['portion'] as string);
  }

  getFeedingMeals(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
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

  getWeightNewLabel(event: PetEvent) {
    return this.formatWeightFromEvent(event);
  }

  getWeightPreviousLabel(event: PetEvent) {
    const weightEvents = this.activityLog.filter((item) => item.eventType === 'WEIGHT');
    const index = weightEvents.findIndex((item) => item.eventId === event.eventId);
    if (index === -1 || index + 1 >= weightEvents.length) {
      return this.translate.instant('dashboard.unknown');
    }
    return this.formatWeightFromEvent(weightEvents[index + 1]);
  }

  getWeightChangeLabel(event: PetEvent) {
    const previous = this.getWeightPreviousLabel(event);
    const current = this.getWeightNewLabel(event);
    if (!previous || previous === this.translate.instant('dashboard.unknown')) {
      return current;
    }
    if (!current || current === this.translate.instant('dashboard.unknown')) {
      return previous;
    }
    return `${previous} → ${current}`;
  }

  getHealthBones() {
    return Array.from({ length: 5 }, (_, index) => index);
  }

  getObservationLabel(event: PetEvent) {
    return event.notes?.trim() || this.translate.instant('dashboard.noDetails');
  }

  openEventWizard() {
    if (!this.pet?.petId) {
      return;
    }
    void this.router.navigate(['/pets', this.pet.petId, 'events', 'new']);
  }

  togglePetMenu() {
    this.showPetMenu = !this.showPetMenu;
  }

  selectPetMenu(_action: 'edit' | 'share' | 'delete') {
    this.showPetMenu = false;
    if (_action === 'edit') {
      if (!this.canManagePet) {
        return;
      }
      if (this.pet?.petId) {
        void this.router.navigate(['/pets', this.pet.petId, 'edit']);
      }
    }
    if (_action === 'share') {
      if (!this.canManagePet) {
        return;
      }
      if (this.pet?.petId) {
        void this.router.navigate(['/pets', this.pet.petId, 'share']);
      }
    }
  }

  private async loadOwners(petId: string) {
    const currentOwnerId = await this.getCurrentOwnerId();
    this.currentOwnerId = currentOwnerId;
    if (!currentOwnerId) {
      this.canManagePet = false;
      this.hasCoOwners = false;
      this.ownersList = [];
      return;
    }
    this.owners.listPetOwners(petId).subscribe({
      next: ({ owners }) => {
        this.ownersList = owners ?? [];
        this.hasCoOwners = this.ownersList.length > 1;
        const match = this.ownersList.find((owner) => owner.ownerId === currentOwnerId);
        this.canManagePet = match?.role === 'PRIMARY';
      },
      error: () => {
        this.canManagePet = false;
        this.hasCoOwners = false;
        this.ownersList = [];
      },
    });
  }

  private async getCurrentOwnerId() {
    const token = await this.auth.getIdToken();
    if (!token) {
      return '';
    }
    try {
      const payload = this.getTokenPayload(token);
      return this.getStringField(payload, ['email', 'username', 'cognito:username', 'sub']);
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

  getOwnerLabel(ownerId?: string) {
    if (!ownerId) {
      return '';
    }
    if (ownerId === this.currentOwnerId) {
      return this.translate.instant('sharePet.you');
    }
    const match = this.ownersList.find((owner) => owner.ownerId === ownerId);
    return match?.profile?.fullName || match?.profile?.email || ownerId;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.showPetMenu) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.card-menu')) {
      this.showPetMenu = false;
    }
  }


  get displayedActivityLog() {
    return this.filteredActivityLog;
  }

  get canLoadMoreActivity() {
    return this.hasMoreEvents;
  }

  loadMoreActivity() {
    if (!this.pet?.petId || !this.hasMoreEvents) {
      return;
    }
    this.isLoadingMoreActivity = true;
    this.events.listPetEvents(this.pet.petId, { limit: 10, cursor: this.eventsCursor }).subscribe({
      next: ({ events, nextCursor }) => {
        this.activityLog = [...this.activityLog, ...(events ?? [])];
        this.eventsCursor = nextCursor ?? '';
        this.hasMoreEvents = Boolean(nextCursor);
      },
      error: () => {
        this.isLoadingMoreActivity = false;
      },
      complete: () => {
        this.isLoadingMoreActivity = false;
      },
    });
  }

  get filteredActivityLog() {
    if (!this.selectedEventTypes.size) {
      return [];
    }
    return this.activityLog.filter((event) => this.selectedEventTypes.has(event.eventType));
  }

  toggleEventTypeFilter(eventType: string) {
    if (this.selectedEventTypes.has(eventType)) {
      this.selectedEventTypes.delete(eventType);
    } else {
      this.selectedEventTypes.add(eventType);
    }
  }

  openReminderDialog() {
    const petId = this.pet?.petId;
    if (!petId) {
      return;
    }
    this.dialog
      .open<ReminderDialogComponent, void, ReminderDialogResult>(ReminderDialogComponent, {
        panelClass: 'pet-dialog',
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) {
          return;
        }
        const metadata: Record<string, unknown> = {
          notes: result.notes || undefined,
        };
        if (result.recurring && result.periodicity) {
          metadata['recurring'] = true;
          metadata['periodicity'] = result.periodicity;
        }
        this.reminders
          .createPetReminder(petId, {
            dueDate: result.dueDate.toISOString(),
            message: result.title,
            metadata,
          })
          .subscribe({
            next: (created) => {
              this.remindersList = [...this.remindersList, created].sort((a, b) => {
                const aDate = new Date(a.dueDate as unknown as string).getTime();
                const bDate = new Date(b.dueDate as unknown as string).getTime();
                return aDate - bDate;
              });
            },
          });
      });
  }

  confirmDeleteActivity(event: PetEvent) {
    const ref = this.dialog.open(DeleteActivityDialogComponent, {
      panelClass: 'pet-dialog',
    });
    ref.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }
      this.deleteActivityEvent(event);
    });
  }

  private deleteActivityEvent(event: PetEvent) {
    if (!this.pet?.petId || !event?.eventId || this.deletingEventIds.has(event.eventId)) {
      return;
    }
    const petId = this.pet.petId;
    this.deletingEventIds.add(event.eventId);
    this.events.deletePetEvent(petId, event.eventId).subscribe({
      next: () => {
        this.loadEvents(petId);
        this.loadReminders(petId);
        this.refreshPet();
      },
      complete: () => {
        this.deletingEventIds.delete(event.eventId);
      },
      error: () => {
        this.deletingEventIds.delete(event.eventId);
      },
    });
  }

  openEventDetail(event: PetEvent) {
    if (!this.pet?.petId || !event?.eventId) {
      return;
    }
    void this.router.navigate(['/pets', this.pet.petId, 'event', event.eventId]);
  }

  deleteReminder(reminder: PetReminder) {
    if (!this.pet?.petId || !reminder?.reminderId || this.deletingReminderIds.has(reminder.reminderId)) {
      return;
    }
    const petId = this.pet.petId;
    this.deletingReminderIds.add(reminder.reminderId);
    this.reminders.deletePetReminder(petId, reminder.reminderId).subscribe({
      next: () => {
        this.loadReminders(petId);
      },
      complete: () => {
        this.deletingReminderIds.delete(reminder.reminderId);
      },
      error: () => {
        this.deletingReminderIds.delete(reminder.reminderId);
      },
    });
  }

  formatEventDate(value?: Date | string) {
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
    });
  }

  formatReminderDate(value?: Date | string) {
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
    });
  }

  formatReminderDateTime(value?: Date | string) {
    if (!value) {
      return '';
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString(this.getLocale(), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  isReminderRecurring(reminder: PetReminder) {
    const recurring = reminder.recurring;
    if (typeof recurring === 'boolean') {
      return recurring;
    }
    const meta = this.getReminderMetadata(reminder);
    return Boolean(meta['recurring'] || meta['periodicity']);
  }

  getReminderNotes(reminder: PetReminder) {
    const meta = this.getReminderMetadata(reminder);
    const notes = typeof meta['notes'] === 'string' ? meta['notes'] : '';
    return notes.trim();
  }

  openShareRecordDialog() {
    if (!this.petId) {
      return;
    }
    void this.router.navigate(['/pets', this.petId, 'share-records']);
  }

  private getLocale() {
    return this.translate.currentLang || this.translate.defaultLang || 'es';
  }

  private formatEventDateWithYear(value?: Date | string) {
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

  private loadEvents(petId: string) {
    this.events.listPetEvents(petId, { limit: 5 }).subscribe({
      next: ({ events, nextCursor }) => {
        this.activityLog = events ?? [];
        this.eventsCursor = nextCursor ?? '';
        this.hasMoreEvents = Boolean(nextCursor);
      },
    });
  }

  private loadReminders(petId: string) {
    this.reminders.listPetReminders(petId).subscribe({
      next: ({ reminders }) => {
        const list = reminders ?? [];
        this.remindersList = list.sort((a, b) => {
          const aDate = new Date(a.dueDate as unknown as string).getTime();
          const bDate = new Date(b.dueDate as unknown as string).getTime();
          return aDate - bDate;
        });
      },
    });
  }

  private refreshPet() {
    this.pets.listPetsFresh().subscribe({
      next: ({ pets }) => {
        const list = pets ?? [];
        if (!list.length) {
          this.pet = null;
          return;
        }
        const activeId = localStorage.getItem(this.activePetKey);
        this.pet = list.find((item) => item.petId === activeId) ?? list[0] ?? null;
      },
    });
  }

  private getNextVaccineReminder() {
    const vaccineKeyword = /(vaccine|vaccination|vacuna)/i;
    const upcoming = this.remindersList.filter((reminder) =>
      vaccineKeyword.test(reminder.message || '')
    );
    return upcoming[0];
  }

  private loadPhoto(petId: string, fileKey: string) {
    this.uploads.generateDownloadUrl(petId, fileKey).subscribe({
      next: ({ downloadUrl }) => {
        this.petPhotoUrl = downloadUrl;
      },
    });
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

  private getPreferredWeightUnit() {
    const stored = localStorage.getItem(this.weightUnitKey);
    return stored === 'lb' ? 'lb' : 'kg';
  }

  private toLb(valueKg: number) {
    const value = valueKg / 0.45359237;
    return Math.round(value * 10) / 10;
  }

  private formatWeightFromEvent(event: PetEvent) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const weightKg = Number(meta['weightKg']);
    if (!Number.isFinite(weightKg)) {
      return this.translate.instant('dashboard.unknown');
    }
    const unit = String(meta['unit'] ?? 'kg');
    if (unit === 'lb') {
      return `${this.toLb(weightKg)} lb`;
    }
    return `${weightKg} kg`;
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


  private getReminderMetadata(reminder: PetReminder): Record<string, unknown> {
    const meta = reminder.metadata;
    if (!meta) {
      return {};
    }
    if (typeof meta === 'string') {
      try {
        const parsed = JSON.parse(meta) as Record<string, unknown>;
        return parsed ?? {};
      } catch {
        return {};
      }
    }
    return meta as Record<string, unknown>;
  }

}
