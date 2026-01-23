import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { EventsService } from '../../core/services/events.service';
import { PetsService } from '../../core/services/pets.service';
import { Pet } from '@pettzi/domain-model';
import { UploadsService } from '../../core/services/uploads.service';

type UploadedAttachment = {
  fileKey: string;
  fileName: string;
  contentType: string;
};

@Component({
  selector: 'app-vet-visit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    TranslateModule,
  ],
  templateUrl: './vet-visit.component.html',
  styleUrl: './vet-visit.component.scss',
})
export class VetVisitComponent {
  private readonly pets = inject(PetsService);
  private readonly events = inject(EventsService);
  private readonly uploads = inject(UploadsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly activePetKey = 'pettzi.activePetId';

  petName = '';
  petId = '';
  activePet: Pet | null = null;

  reason = '';
  visitDate: Date | null = null;
  clinic = '';
  veterinarian = '';
  notes = '';
  attachments: File[] = [];
  isSubmitting = false;

  get isFormValid() {
    if (!this.petId || !this.visitDate) {
      return false;
    }
    if (this.isAfterToday(this.visitDate)) {
      return false;
    }
    return this.reason.trim().length > 0 && this.clinic.trim().length > 0;
  }

  get maxVisitDate() {
    return this.startOfDay(new Date());
  }

  ngOnInit() {
    const routePetId = this.route.snapshot.paramMap.get('petId') ?? '';
    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        const list = pets ?? [];
        const activeId = localStorage.getItem(this.activePetKey);
        const targetId = routePetId || activeId || '';
        const activePet = targetId ? list.find((pet) => pet.petId === targetId) : list[0];
        this.activePet = activePet ?? null;
        this.petName = activePet?.name ?? '';
        this.petId = activePet?.petId ?? '';
        if (this.petId) {
          localStorage.setItem(this.activePetKey, this.petId);
        }
      },
    });
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

  async saveVisit() {
    if (!this.isFormValid || this.isSubmitting || !this.visitDate) {
      return;
    }
    this.isSubmitting = true;

    try {
      const uploaded = await this.uploadAttachments();
      const payload = {
        eventType: 'VET_VISIT' as const,
        date: this.visitDate.toISOString(),
        title: this.reason.trim(),
        notes: this.notes.trim() || undefined,
        metadata: {
          clinic: this.clinic.trim(),
          veterinarian: this.veterinarian.trim() || undefined,
          attachments: uploaded,
          reason: this.reason.trim(),
        },
      };

      await firstValueFrom(this.events.createPetEvent(this.petId, payload));
      this.updateLastVetVisitDate();
      void this.router.navigate(['/pets', this.petId]);
    } catch {
      this.isSubmitting = false;
    }
  }

  private updateLastVetVisitDate() {
    if (!this.activePet || !this.visitDate) {
      return;
    }
    const last = this.activePet.lastVetVisitDate
      ? new Date(this.activePet.lastVetVisitDate as unknown as string)
      : null;
    if (last && last.getTime() >= this.visitDate.getTime()) {
      return;
    }
    this.pets
      .updatePet(this.activePet.petId, { lastVetVisitDate: this.visitDate })
      .subscribe();
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
      if (!upload) {
        throw new Error(this.translate.instant('errors.network'));
      }

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
