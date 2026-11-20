import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PetsService } from '../../core/services/pets.service';
import { EventsService } from '../../core/services/events.service';
import { RemindersService } from '../../core/services/reminders.service';

type GroomingService = {
  id: string;
  labelKey: string;
  icon: string;
};

@Component({
  selector: 'app-grooming',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    TranslateModule,
  ],
  templateUrl: './grooming.component.html',
  styleUrl: './grooming.component.scss',
})
export class GroomingComponent {
  private readonly pets = inject(PetsService);
  private readonly events = inject(EventsService);
  private readonly reminders = inject(RemindersService);
  private readonly translate = inject(TranslateService);
  @Input() petId = '';
  @Output() saved = new EventEmitter<void>();

  services: GroomingService[] = [
    { id: 'full-bath', labelKey: 'grooming.services.fullBath', icon: 'bathtub' },
    { id: 'haircut', labelKey: 'grooming.services.haircut', icon: 'content_cut' },
    { id: 'nails', labelKey: 'grooming.services.nails', icon: 'content_paste' },
  ];

  selectedServices = new Set<string>();
  preferredDate: Date | null = null;
  nextGroomingDate: Date | null = null;
  instructions = '';
  clinic = '';
  groomer = '';
  isSubmitting = false;

  get isFormValid() {
    if (!this.petId || this.selectedServices.size === 0 || !this.preferredDate) {
      return false;
    }
    if (this.isAfterToday(this.preferredDate)) {
      return false;
    }
    if (this.nextGroomingDate && this.isBeforeTomorrow(this.nextGroomingDate)) {
      return false;
    }
    return true;
  }

  get maxGroomingDate() {
    return this.startOfDay(new Date());
  }

  get minNextGroomingDate() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return this.startOfDay(date);
  }

  toggleService(id: string) {
    if (this.selectedServices.has(id)) {
      this.selectedServices.delete(id);
      return;
    }
    this.selectedServices.add(id);
  }

  saveGrooming() {
    if (!this.isFormValid || this.isSubmitting || !this.preferredDate) {
      return;
    }
    this.isSubmitting = true;
    const payload = {
      eventType: 'GROOMING' as const,
      date: this.preferredDate.toISOString(),
      title: this.translate.instant('grooming.eventTitle'),
      notes: this.instructions.trim() || undefined,
      metadata: {
        services: Array.from(this.selectedServices),
        clinic: this.clinic.trim() || undefined,
        groomer: this.groomer.trim() || undefined,
      },
    };

    this.events.createPetEvent(this.petId, payload).subscribe({
      next: (createdEvent) => {
        this.updateLastGroomingDate();
        if (!this.nextGroomingDate) {
          this.saved.emit();
          this.isSubmitting = false;
          return;
        }
        const reminderPayload = {
          dueDate: this.nextGroomingDate.toISOString(),
          eventId: createdEvent.eventId,
          message: this.translate.instant('grooming.reminderMessage'),
        };
        this.reminders.createPetReminder(this.petId, reminderPayload).subscribe({
          next: () => {
            this.saved.emit();
            this.isSubmitting = false;
          },
          error: () => {
            this.isSubmitting = false;
          },
        });
      },
      error: () => {
        this.isSubmitting = false;
      },
    });
  }

  private updateLastGroomingDate() {
    if (!this.petId || !this.preferredDate) {
      return;
    }
    this.pets
      .updatePet(this.petId, { lastGroomingDate: this.preferredDate })
      .subscribe();
  }

  submit() {
    this.saveGrooming();
  }

  private startOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private isAfterToday(value: Date) {
    return this.startOfDay(value).getTime() > this.startOfDay(new Date()).getTime();
  }

  private isBeforeTomorrow(value: Date) {
    return this.startOfDay(value).getTime() < this.minNextGroomingDate.getTime();
  }

}
