import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { EventsService } from '../../core/services/events.service';
import { RemindersService } from '../../core/services/reminders.service';
import { UploadsService } from '../../core/services/uploads.service';

type Periodicity = 'hours' | 'daily' | 'weekly' | 'monthly';

type UploadedAttachment = {
  fileKey: string;
  fileName: string;
  contentType: string;
};

@Component({
  selector: 'app-medication',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    TranslateModule,
  ],
  templateUrl: './medication.component.html',
  styleUrl: './medication.component.scss',
})
export class MedicationComponent {
  private readonly events = inject(EventsService);
  private readonly reminders = inject(RemindersService);
  private readonly uploads = inject(UploadsService);
  private readonly translate = inject(TranslateService);
  @Input() petId = '';
  @Output() saved = new EventEmitter<void>();

  name = '';
  dose = '';
  periodicity: Periodicity | '' = '';
  endIndefinite = true;
  endDate: Date | null = null;
  observations = '';
  attachments: File[] = [];

  hoursEvery = 8;
  dailyTime = '09:00';
  weeklyDay = '1';
  weeklyTime = '09:00';
  monthlyDay = 1;
  monthlyTime = '09:00';

  createReminder = false;
  isSubmitting = false;

  get maxMedicationDate() {
    return this.startOfDay(new Date());
  }

  get shouldOfferReminder() {
    if (this.endIndefinite) {
      return true;
    }
    if (!this.endDate) {
      return false;
    }
    return this.startOfDay(this.endDate).getTime() > this.startOfDay(new Date()).getTime();
  }

  get isFormValid() {
    if (!this.petId) {
      return false;
    }
    if (!this.name.trim() || !this.dose.trim() || !this.periodicity) {
      return false;
    }
    if (!this.endIndefinite && !this.endDate) {
      return false;
    }
    return this.isPeriodicityValid();
  }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) {
      return;
    }
    this.attachments = [...this.attachments, ...files];
    input.value = '';
  }

  removeAttachment(index: number) {
    this.attachments = this.attachments.filter((_, i) => i !== index);
  }

  async saveMedication() {
    if (!this.isFormValid || this.isSubmitting) {
      return;
    }
    this.isSubmitting = true;

    try {
      const uploaded = await this.uploadAttachments();
      const metadata = {
        dose: this.dose.trim(),
        periodicity: this.buildPeriodicityMetadata(),
        endDate: this.endIndefinite ? null : this.endDate?.toISOString(),
        indefinite: this.endIndefinite,
        attachments: uploaded,
        name: this.name.trim(),
      };

      const eventPayload = {
        eventType: 'MEDICATION' as const,
        date: new Date().toISOString(),
        title: this.name.trim(),
        notes: this.observations.trim() || undefined,
        metadata,
      };

      const createdEvent = await firstValueFrom(
        this.events.createPetEvent(this.petId, eventPayload)
      );

      if (this.createReminder && this.shouldOfferReminder) {
        const reminderPayload = {
          dueDate: this.computeNextReminderDate().toISOString(),
          eventId: createdEvent.eventId,
          message: this.translate.instant('medication.reminderMessage', {
            name: this.name.trim(),
          }),
          metadata,
        };
        await firstValueFrom(this.reminders.createPetReminder(this.petId, reminderPayload));
      }

      this.isSubmitting = false;
      this.saved.emit();
    } catch {
      this.isSubmitting = false;
    }
  }

  submit() {
    void this.saveMedication();
  }

  private isPeriodicityValid() {
    if (this.periodicity === 'hours') {
      return this.hoursEvery >= 1;
    }
    if (this.periodicity === 'daily') {
      return Boolean(this.dailyTime);
    }
    if (this.periodicity === 'weekly') {
      return Boolean(this.weeklyTime) && this.weeklyDay !== '';
    }
    if (this.periodicity === 'monthly') {
      return Boolean(this.monthlyTime) && this.monthlyDay >= 1 && this.monthlyDay <= 31;
    }
    return false;
  }

  private buildPeriodicityMetadata() {
    switch (this.periodicity) {
      case 'hours':
        return { type: 'hours', everyHours: this.hoursEvery };
      case 'daily':
        return { type: 'daily', time: this.dailyTime };
      case 'weekly':
        return { type: 'weekly', weekday: Number(this.weeklyDay), time: this.weeklyTime };
      case 'monthly':
        return { type: 'monthly', dayOfMonth: this.monthlyDay, time: this.monthlyTime };
      default:
        return { type: 'daily' };
    }
  }

  private computeNextReminderDate() {
    const now = new Date();
    if (this.periodicity === 'hours') {
      const next = new Date(now.getTime() + this.hoursEvery * 60 * 60 * 1000);
      return next;
    }
    if (this.periodicity === 'daily') {
      return this.nextTimeOfDay(now, this.dailyTime);
    }
    if (this.periodicity === 'weekly') {
      return this.nextWeekday(now, Number(this.weeklyDay), this.weeklyTime);
    }
    if (this.periodicity === 'monthly') {
      return this.nextMonthDay(now, this.monthlyDay, this.monthlyTime);
    }
    return now;
  }

  private async uploadAttachments(): Promise<UploadedAttachment[]> {
    if (!this.attachments.length) {
      return [];
    }

    const uploaded: UploadedAttachment[] = [];
    for (const file of this.attachments) {
      const upload = await firstValueFrom(
        this.uploads.generateDocumentUploadUrl(
          this.petId,
          file.type || 'application/octet-stream'
        )
      );

      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': upload.contentType,
        },
        body: file,
      });

      if (!response.ok) {
        throw new Error(this.translate.instant('errors.network'));
      }

      uploaded.push({
        fileKey: upload.fileKey,
        fileName: file.name,
        contentType: upload.contentType,
      });
    }

    return uploaded;
  }

  private nextTimeOfDay(base: Date, timeValue: string) {
    const [hours, minutes] = timeValue.split(':').map(Number);
    const candidate = new Date(base);
    candidate.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    if (candidate <= base) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate;
  }

  private nextWeekday(base: Date, weekday: number, timeValue: string) {
    const target = this.nextTimeOfDay(base, timeValue);
    const currentDay = target.getDay();
    const diff = (weekday - currentDay + 7) % 7;
    if (diff === 0 && target <= base) {
      target.setDate(target.getDate() + 7);
      return target;
    }
    target.setDate(target.getDate() + diff);
    return target;
  }

  private nextMonthDay(base: Date, day: number, timeValue: string) {
    const target = this.nextTimeOfDay(base, timeValue);
    const year = target.getFullYear();
    const month = target.getMonth();
    const maxDay = new Date(year, month + 1, 0).getDate();
    const chosenDay = Math.min(day, maxDay);
    target.setDate(chosenDay);
    if (target <= base) {
      const nextMonth = new Date(year, month + 1, 1);
      const nextMax = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate();
      nextMonth.setDate(Math.min(day, nextMax));
      nextMonth.setHours(target.getHours(), target.getMinutes(), 0, 0);
      return nextMonth;
    }
    return target;
  }

  private startOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
