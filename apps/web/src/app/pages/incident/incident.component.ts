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
import { UploadsService } from '../../core/services/uploads.service';

type UploadedAttachment = {
  fileKey: string;
  fileName: string;
  contentType: string;
};

@Component({
  selector: 'app-incident',
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
  templateUrl: './incident.component.html',
  styleUrl: './incident.component.scss',
})
export class IncidentComponent {
  private readonly events = inject(EventsService);
  private readonly uploads = inject(UploadsService);
  private readonly translate = inject(TranslateService);
  @Input() petId = '';
  @Output() saved = new EventEmitter<void>();

  incidentName = '';
  incidentDate: Date | null = new Date();
  description = '';
  attachments: File[] = [];
  isSubmitting = false;

  get maxIncidentDate() {
    return this.startOfDay(new Date());
  }

  get isFormValid() {
    if (!this.petId || !this.incidentName.trim() || !this.incidentDate) {
      return false;
    }
    if (this.isAfterToday(this.incidentDate)) {
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

  async saveIncident() {
    if (!this.isFormValid || this.isSubmitting || !this.incidentDate) {
      return;
    }
    this.isSubmitting = true;
    try {
      const uploaded = await this.uploadAttachments();
      const eventPayload = {
        eventType: 'INCIDENT' as const,
        date: this.incidentDate.toISOString(),
        title: this.incidentName.trim(),
        notes: this.description.trim() || undefined,
        metadata: {
          attachments: uploaded,
        },
      };
      await firstValueFrom(this.events.createPetEvent(this.petId, eventPayload));
      this.isSubmitting = false;
      this.saved.emit();
    } catch {
      this.isSubmitting = false;
    }
  }

  submit() {
    void this.saveIncident();
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

  private isAfterToday(value: Date) {
    return this.startOfDay(value).getTime() > this.startOfDay(new Date()).getTime();
  }
}
