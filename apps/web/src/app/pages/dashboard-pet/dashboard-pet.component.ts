import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Pet, PetEvent, PetReminder } from '@pettzi/domain-model';
import { PetsService } from '../../core/services/pets.service';
import { UploadsService } from '../../core/services/uploads.service';
import { EventsService } from '../../core/services/events.service';
import { RemindersService } from '../../core/services/reminders.service';

@Component({
  selector: 'app-dashboard-pet',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, TranslateModule],
  templateUrl: './dashboard-pet.component.html',
  styleUrl: './dashboard-pet.component.scss',
})
export class DashboardPetComponent implements OnInit {
  private readonly pets = inject(PetsService);
  private readonly router = inject(Router);
  private readonly uploads = inject(UploadsService);
  private readonly events = inject(EventsService);
  private readonly reminders = inject(RemindersService);
  private readonly translate = inject(TranslateService);
  private readonly weightUnitKey = 'pettzi.weightUnit';
  private readonly activePetKey = 'pettzi.activePetId';

  pet: Pet | null = null;
  petPhotoUrl = '';
  activityLog: PetEvent[] = [];
  remindersList: PetReminder[] = [];
  showActivityMenu = false;

  ngOnInit() {
    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        const list = pets ?? [];
        if (list.length === 0) {
          void this.router.navigate(['/pets/new']);
          return;
        }
        this.pet = list[0] ?? null;
        if (this.pet?.petId) {
          localStorage.setItem(this.activePetKey, this.pet.petId);
        }
        if (this.pet?.petId && this.pet.photoKey) {
          this.loadPhoto(this.pet.petId, this.pet.photoKey);
        }
        if (this.pet?.petId) {
          this.loadEvents(this.pet.petId);
          this.loadReminders(this.pet.petId);
        }
      },
      error: () => {
        void this.router.navigate(['/']);
      },
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
    return this.activityLog.length ? '98%' : this.translate.instant('dashboard.healthDataNeeded');
  }

  get healthScoreSubtitle() {
    return this.activityLog.length
      ? this.translate.instant('dashboard.healthKeepUp')
      : this.translate.instant('dashboard.healthAddData');
  }

  get showHealthStatus() {
    return this.activityLog.length > 0;
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

  toggleActivityMenu() {
    this.showActivityMenu = !this.showActivityMenu;
  }

  closeActivityMenu() {
    this.showActivityMenu = false;
  }

  selectActivity(type: string) {
    this.closeActivityMenu();
    if (type === 'GROOMING') {
      void this.router.navigate(['/dashboard/grooming']);
    }
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

  private getLocale() {
    return this.translate.currentLang || this.translate.defaultLang || 'es';
  }

  private loadEvents(petId: string) {
    this.events.listPetEvents(petId).subscribe({
      next: ({ events }) => {
        const list = events ?? [];
        this.activityLog = list.sort((a, b) => {
          const aDate = new Date(a.eventDate as unknown as string).getTime();
          const bDate = new Date(b.eventDate as unknown as string).getTime();
          return bDate - aDate;
        });
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

  private getPreferredWeightUnit() {
    const stored = localStorage.getItem(this.weightUnitKey);
    return stored === 'lb' ? 'lb' : 'kg';
  }

  private toLb(valueKg: number) {
    const value = valueKg / 0.45359237;
    return Math.round(value * 10) / 10;
  }
}
