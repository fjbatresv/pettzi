import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
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
  selector: 'app-vaccine',
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
  templateUrl: './vaccine.component.html',
  styleUrl: './vaccine.component.scss',
})
export class VaccineComponent {
  private readonly events = inject(EventsService);
  private readonly reminders = inject(RemindersService);
  private readonly uploads = inject(UploadsService);
  private readonly translate = inject(TranslateService);
  @Input() petId = '';
  @Output() saved = new EventEmitter<void>();

  name = '';
  administeredDate: Date | null = null;
  expiryDate: Date | null = null;
  batchNumber = '';
  clinic = '';
  veterinarian = '';
  attachments: File[] = [];
  createReminder = false;
  isSubmitting = false;

  get maxAdminDate() {
    return this.startOfDay(new Date());
  }

  get isFormValid() {
    return (
      this.petId &&
      this.name.trim().length > 0 &&
      !!this.administeredDate &&
      this.batchNumber.trim().length > 0
    );
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

  async saveVaccine() {
    if (!this.isFormValid || this.isSubmitting || !this.administeredDate) {
      return;
    }
    this.isSubmitting = true;

    try {
      const uploaded = await this.uploadAttachments();
      const metadata = {
        batchNumber: this.batchNumber.trim(),
        clinic: this.clinic.trim() || undefined,
        veterinarian: this.veterinarian.trim() || undefined,
        expiryDate: this.expiryDate?.toISOString(),
        attachments: uploaded,
        name: this.name.trim()
      };

      const eventPayload = {
        eventType: 'VACCINE' as const,
        date: this.administeredDate.toISOString(),
        title: this.name.trim(),
        metadata,
      };

      const createdEvent = await firstValueFrom(
        this.events.createPetEvent(this.petId, eventPayload)
      );

      if (this.createReminder && this.expiryDate) {
        const reminderDate = new Date(this.expiryDate);
        reminderDate.setDate(reminderDate.getDate() - 7);
        const reminderPayload = {
          dueDate: reminderDate.toISOString(),
          eventId: createdEvent.eventId,
          message: this.translate.instant('vaccine.reminderMessage', {
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
    void this.saveVaccine();
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

  private startOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
