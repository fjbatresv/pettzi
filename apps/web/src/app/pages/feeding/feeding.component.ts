import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { EventsService } from '../../core/services/events.service';
import { RemindersService } from '../../core/services/reminders.service';
import { UploadsService } from '../../core/services/uploads.service';

type UploadedAttachment = {
  fileKey: string;
  fileName: string;
  contentType: string;
};

@Component({
  selector: 'app-feeding',
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
    TranslateModule,
  ],
  templateUrl: './feeding.component.html',
  styleUrl: './feeding.component.scss',
})
export class FeedingComponent implements OnInit {
  private readonly events = inject(EventsService);
  private readonly reminders = inject(RemindersService);
  private readonly uploads = inject(UploadsService);
  private readonly translate = inject(TranslateService);
  @Input() petId = '';
  @Output() saved = new EventEmitter<void>();

  feedingDate: Date | null = new Date();
  previousFood = '';
  newFood = '';
  portion = '';
  mealTimes = 2;
  attachments: File[] = [];

  createReminder = false;
  firstReminderTime = '08:00';
  isSubmitting = false;
  isLoadingPrevious = false;

  ngOnInit() {
    void this.loadPreviousFood();
  }

  get maxFeedingDate() {
    return this.startOfDay(new Date());
  }

  get isFormValid() {
    if (!this.petId || !this.feedingDate) {
      return false;
    }
    if (this.isAfterToday(this.feedingDate)) {
      return false;
    }
    if (!this.previousFood.trim() || !this.newFood.trim() || !this.portion.trim()) {
      return false;
    }
    if (this.mealTimes < 1) {
      return false;
    }
    if (this.createReminder && !this.firstReminderTime) {
      return false;
    }
    return true;
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

  async saveFeeding() {
    if (!this.isFormValid || this.isSubmitting || !this.feedingDate) {
      return;
    }
    this.isSubmitting = true;
    try {
      const uploaded = await this.uploadAttachments();
      const metadata = {
        previousFood: this.previousFood.trim(),
        newFood: this.newFood.trim(),
        portion: this.portion.trim(),
        mealTimes: this.mealTimes,
        attachments: uploaded,
      };

      const eventPayload = {
        eventType: 'FEEDING' as const,
        date: this.feedingDate.toISOString(),
        title: this.newFood.trim(),
        metadata,
      };

      const createdEvent = await firstValueFrom(
        this.events.createPetEvent(this.petId, eventPayload)
      );

      if (this.createReminder) {
        const everyHours = this.computeMealInterval();
        const reminderPayload = {
          dueDate: this.computeFirstReminderDate().toISOString(),
          eventId: createdEvent.eventId,
          message: this.translate.instant('feeding.reminderMessage', {
            food: this.newFood.trim(),
            portion: this.portion.trim(),
          }),
          metadata: {
            food: this.newFood.trim(),
            portion: this.portion.trim(),
            mealTimes: this.mealTimes,
            recurring: true,
            periodicity: {
              type: 'hours',
              everyHours,
            },
          },
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
    void this.saveFeeding();
  }

  private async loadPreviousFood() {
    if (!this.petId || this.isLoadingPrevious || this.previousFood.trim()) {
      return;
    }
    this.isLoadingPrevious = true;
    try {
      let cursor: string | undefined;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await firstValueFrom(
          this.events.listPetEvents(this.petId, { limit: 20, cursor })
        );
        const match = (response.events ?? []).find((event) => event.eventType === 'FEEDING');
        if (match) {
          const meta = this.getMetadata(match.metadata);
          const newFood = (meta['newFood'] as string) || match.title || '';
          if (newFood && !this.previousFood.trim()) {
            this.previousFood = newFood;
          }
          break;
        }
        if (!response.nextCursor) {
          break;
        }
        cursor = response.nextCursor;
      }
    } finally {
      this.isLoadingPrevious = false;
    }
  }

  private computeMealInterval() {
    const times = Math.max(1, Number(this.mealTimes) || 1);
    return 24 / times;
  }

  private computeFirstReminderDate() {
    const now = new Date();
    return this.nextTimeOfDay(now, this.firstReminderTime);
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

  private getMetadata(meta: unknown) {
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

  private startOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private isAfterToday(value: Date) {
    return this.startOfDay(value).getTime() > this.startOfDay(new Date()).getTime();
  }
}
