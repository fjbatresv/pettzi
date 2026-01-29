import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { EventType } from '@pettzi/domain-model';
import { PetsService } from '../../core/services/pets.service';

interface ShareRecordDialogData {
  petId: string;
  petName: string;
}

@Component({
  selector: 'app-share-record-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    TranslateModule,
  ],
  templateUrl: './share-record-dialog.component.html',
  styleUrl: './share-record-dialog.component.scss',
})
export class ShareRecordDialogComponent {
  private readonly pets = inject(PetsService);
  private readonly translate = inject(TranslateService);
  readonly data = inject<ShareRecordDialogData>(MAT_DIALOG_DATA);
  readonly expirationOptions = [
    { value: '24h', label: 'shareRecord.expiration24h' },
    { value: '3d', label: 'shareRecord.expiration3d' },
    { value: '1w', label: 'shareRecord.expiration1w' },
    { value: '1m', label: 'shareRecord.expiration1m' },
  ] as const;

  readonly recordOptions = [
    { type: EventType.MEDICATION, label: 'dashboard.activityMedication' },
    { type: EventType.GROOMING, label: 'dashboard.activityGrooming' },
    { type: EventType.VET_VISIT, label: 'dashboard.activityVetVisit' },
    { type: EventType.VACCINE, label: 'dashboard.activityVaccine' },
    { type: EventType.WEIGHT, label: 'dashboard.activityWeight' },
    { type: EventType.INCIDENT, label: 'dashboard.activityIncident' },
    { type: EventType.WALK, label: 'dashboard.activityWalk' },
    { type: EventType.FEEDING, label: 'dashboard.activityFeeding' },
  ] as const;
  selectedTypes = new Set<EventType>(this.recordOptions.map((option) => option.type));
  expiration: '24h' | '3d' | '1w' | '1m' = '24h';
  password = '';
  isSubmitting = false;
  copiedLink = '';
  statusMessage = '';
  isCopying = false;

  @ViewChild('shareLinkInput') shareLinkInput?: ElementRef<HTMLInputElement>;

  get canSubmit() {
    return !this.isSubmitting && this.selectedTypes.size > 0;
  }

  toggleType(type: EventType, selected: boolean) {
    if (selected) {
      this.selectedTypes.add(type);
    } else {
      this.selectedTypes.delete(type);
    }
  }

  selectLink(event?: Event) {
    if (event) {
      event.preventDefault();
    }
    const input = this.shareLinkInput?.nativeElement;
    if (!input) {
      return;
    }
    input.focus();
    input.select();
    input.setSelectionRange(0, input.value.length);
  }

  async copyLink() {
    if (!this.copiedLink || this.isCopying) {
      return;
    }

    this.isCopying = true;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(this.copiedLink);
        this.statusMessage = this.translate.instant('shareRecord.copySuccess');
      } else {
        this.selectLink();
        const copied = document.execCommand?.('copy');
        this.statusMessage = copied
          ? this.translate.instant('shareRecord.copySuccess')
          : this.translate.instant('shareRecord.copyManual');
      }
    } catch {
      this.statusMessage = this.translate.instant('shareRecord.copyManual');
    } finally {
      this.isCopying = false;
    }
  }

  async createLink() {
    if (!this.canSubmit) {
      return;
    }

    this.isSubmitting = true;
    this.statusMessage = '';
    this.copiedLink = '';

    const items = Array.from(this.selectedTypes);

    try {
      const response = await firstValueFrom(
        this.pets.createSharedRecord(this.data.petId, {
          items,
          expiresIn: this.expiration,
          password: this.password.trim() || undefined,
        })
      );

      const origin = window.location.origin;
      const shareUrl = `${origin}/pet-record?token=${response.token}`;
      this.copiedLink = shareUrl;
      await this.copyLink();
    } catch {
      this.statusMessage = this.translate.instant('shareRecord.copyError');
    } finally {
      this.isSubmitting = false;
    }
  }
}
