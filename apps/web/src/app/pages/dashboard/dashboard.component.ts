import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Pet, PetReminder } from '@pettzi/domain-model';
import { PetsService } from '../../core/services/pets.service';
import { RemindersService } from '../../core/services/reminders.service';
import { UploadsService } from '../../core/services/uploads.service';
import { CatalogsService, BreedItem, SpeciesItem } from '../../core/services/catalogs.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, TranslateModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly pets = inject(PetsService);
  private readonly router = inject(Router);
  private readonly reminders = inject(RemindersService);
  private readonly uploads = inject(UploadsService);
  private readonly catalogs = inject(CatalogsService);
  private readonly translate = inject(TranslateService);
  private readonly destroy$ = new Subject<void>();

  petsList: Pet[] = [];
  remindersList: ReminderEntry[] = [];
  groupedReminders: ReminderGroup[] = [];
  petPhotos = new Map<string, string>();
  speciesOptions: SpeciesItem[] = [];
  breedOptions: BreedItem[] = [];
  isLoading = true;
  deletingReminderIds = new Set<string>();

  ngOnInit() {
    this.pets.listPets().pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ pets }) => {
        const count = (pets ?? []).length;
        if (count === 0) {
          void this.router.navigate(['/pets/new']);
          return;
        }
        if (count === 1) {
          void this.router.navigate(['/pets', pets?.[0]?.petId]);
          return;
        }
        const list = pets ?? [];
        this.petsList = [...list].sort((a, b) =>
          (a.name ?? '').localeCompare(b.name ?? '', this.getLocale(), { sensitivity: 'base' })
        );
        this.loadCatalogs();
        this.loadPhotos();
        this.loadReminders();
      },
      error: () => {
        void this.router.navigate(['/login']);
      },
    });

    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.loadCatalogs();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openPet(pet: Pet) {
    if (!pet?.petId) {
      return;
    }
    void this.router.navigate(['/pets', pet.petId]);
  }

  getPetPhoto(pet: Pet) {
    return pet?.petId ? this.petPhotos.get(pet.petId) || '' : '';
  }

  getPetSubtitle(pet: Pet) {
    const age = this.getAgeLabel(pet);
    const breed = this.getBreedLabel(pet);
    const species = this.getSpeciesLabel(pet);
    const label = breed || species;
    if (age && label) {
      return `${age} • ${label}`;
    }
    return age || label || this.translate.instant('dashboard.unknown');
  }

  getNextReminder(pet: Pet) {
    return this.remindersList.find((entry) => entry.pet.petId === pet.petId) || null;
  }

  formatReminderTime(reminder: ReminderEntry) {
    return reminder.dueDate.toLocaleTimeString(this.getLocale(), {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatReminderDate(reminder: ReminderEntry) {
    return reminder.dueDate.toLocaleDateString(this.getLocale(), {
      month: 'short',
      day: 'numeric',
    });
  }

  getReminderTitle(reminder: ReminderEntry) {
    const message = reminder.reminder.message?.trim();
    if (message) {
      return message;
    }
    return this.translate.instant('home.reminderFallback');
  }

  isRecurring(reminder: ReminderEntry) {
    const recurring = reminder.reminder.recurring;
    if (typeof recurring === 'boolean') {
      return recurring;
    }
    const meta = this.getReminderMetadata(reminder.reminder);
    return Boolean(meta['recurring'] || meta['periodicity']);
  }

  deleteReminder(reminder: ReminderEntry) {
    const reminderId = reminder.reminder.reminderId;
    const petId = reminder.pet.petId;
    if (!reminderId || !petId || this.deletingReminderIds.has(reminderId)) {
      return;
    }
    this.deletingReminderIds.add(reminderId);
    this.reminders.deletePetReminder(petId, reminderId).subscribe({
      next: () => {
        this.remindersList = this.remindersList.filter(
          (item) => item.reminder.reminderId !== reminderId
        );
        this.groupedReminders = this.groupByDate(this.remindersList);
      },
      complete: () => {
        this.deletingReminderIds.delete(reminderId);
      },
      error: () => {
        this.deletingReminderIds.delete(reminderId);
      },
    });
  }

  private loadCatalogs() {
    this.catalogs.getSpecies().pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ species }) => {
        this.speciesOptions = species ?? [];
      },
      error: () => {
        this.speciesOptions = [];
      },
    });

    const species = Array.from(
      new Set(this.petsList.map((pet) => pet.species).filter(Boolean))
    );
    if (!species.length) {
      return;
    }
    forkJoin(species.map((code) => this.catalogs.getBreeds(code)))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (responses) => {
        this.breedOptions = responses.flatMap((res) => res.breeds ?? []);
      },
      error: () => {
        this.breedOptions = [];
      },
    });
  }

  private loadPhotos() {
    this.petsList.forEach((pet) => {
      const photoKey = pet.photoThumbnailKey ?? pet.photoKey;
      if (!pet.petId || !photoKey) {
        return;
      }
      this.uploads
        .generateDownloadUrl(pet.petId, photoKey)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
        next: ({ downloadUrl }) => {
          this.petPhotos.set(pet.petId, downloadUrl);
        },
      });
    });
  }

  private loadReminders() {
    const requests = this.petsList.map((pet) => this.reminders.listPetReminders(pet.petId));
    forkJoin(requests).pipe(takeUntil(this.destroy$)).subscribe({
      next: (responses) => {
        const entries: ReminderEntry[] = [];
        responses.forEach((response, index) => {
          const pet = this.petsList[index];
          (response.reminders ?? []).forEach((reminder) => {
            const due = new Date(reminder.dueDate as unknown as string);
            if (Number.isNaN(due.getTime())) {
              return;
            }
            entries.push({
              reminder,
              pet,
              dueDate: due,
            });
          });
        });
        entries.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
        this.remindersList = entries;
        this.groupedReminders = this.groupByDate(entries);
        this.isLoading = false;
      },
      error: () => {
        this.remindersList = [];
        this.groupedReminders = [];
        this.isLoading = false;
      },
    });
  }

  private groupByDate(entries: ReminderEntry[]): ReminderGroup[] {
    const groups = new Map<string, ReminderGroup>();
    entries.forEach((entry) => {
      const dateKey = entry.dueDate.toDateString();
      const label = entry.dueDate.toLocaleDateString(this.getLocale(), {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
      const group = groups.get(dateKey) ?? { label, items: [] };
      group.items.push(entry);
      groups.set(dateKey, group);
    });
    return Array.from(groups.values());
  }

  private getBreedLabel(pet: Pet) {
    if (!pet.breed) {
      return '';
    }
    const match = this.breedOptions.find((item) => item.code === pet.breed);
    return match?.label || pet.breed || '';
  }

  private getSpeciesLabel(pet: Pet) {
    if (!pet.species) {
      return '';
    }
    const match = this.speciesOptions.find((item) => item.code === pet.species);
    return match?.label || pet.species || '';
  }

  private getAgeLabel(pet: Pet) {
    if (!pet.birthDate) {
      return '';
    }
    const birth = pet.birthDate instanceof Date ? pet.birthDate : new Date(pet.birthDate as any);
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
      return this.translate.instant('home.yearsOld', { count: years });
    }
    return this.translate.instant('home.monthsOld', { count: Math.max(months, 0) });
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

  private getLocale() {
    return this.translate.currentLang || this.translate.defaultLang || 'es';
  }
}

interface ReminderEntry {
  reminder: PetReminder;
  pet: Pet;
  dueDate: Date;
}

interface ReminderGroup {
  label: string;
  items: ReminderEntry[];
}
