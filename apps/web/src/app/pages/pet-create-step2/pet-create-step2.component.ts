import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { CreateHeaderComponent } from '../../components/create-header/create-header.component';
import { I18nService } from '../../core/i18n/i18n.service';
import { PetCreateStateService, PetCreateDraft } from '../../core/services/pet-create-state.service';
import { PetsService } from '../../core/services/pets.service';
import { UploadsService } from '../../core/services/uploads.service';
import { PetSpecies } from '@pettzi/domain-model';

type WeightUnit = 'lb' | 'kg';

@Component({
  selector: 'app-pet-create-step2',
  imports: [
    CommonModule,
    CreateHeaderComponent,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    RouterLink,
    TranslateModule,
  ],
  standalone: true,
  templateUrl: './pet-create-step2.component.html',
  styleUrl: './pet-create-step2.component.scss',
})
export class PetCreateStep2Component {
  private readonly i18n = inject(I18nService);
  private readonly state = inject(PetCreateStateService);
  private readonly router = inject(Router);
  private readonly pets = inject(PetsService);
  private readonly uploads = inject(UploadsService);
  draft: PetCreateDraft | null = null;
  selectedDate: Date | null = null;
  birthdayValue = '';
  ageLabel = '';
  weightValue: number | null = null;
  weightUnit: WeightUnit = 'lb';
  sex = '';
  isSubmitting = false;
  showValidation = false;
  errorMessage = '';

  get maxDate() {
    return this.toDateInputValue(new Date());
  }

  get ageDisplay() {
    return this.ageLabel || this.i18n.t('createPet.agePill');
  }

  get isFormValid() {
    return (
      !!this.draft &&
      !!this.selectedDate &&
      this.weightValue !== null &&
      this.weightValue > 0 &&
      !!this.sex
    );
  }

  ngOnInit() {
    this.draft = this.state.getDraft();
    if (!this.draft) {
      void this.router.navigate(['/pets/new']);
      return;
    }
    const defaultDate = this.getDefaultBirthday();
    this.birthdayValue = this.toDateInputValue(defaultDate);
    this.selectedDate = defaultDate;
    this.updateAgeLabel();
  }

  setWeightUnit(unit: WeightUnit) {
    if (this.weightUnit === unit) {
      return;
    }
    if (this.weightValue !== null && !Number.isNaN(this.weightValue)) {
      const converted =
        unit === 'kg'
          ? this.weightValue * 0.45359237
          : this.weightValue / 0.45359237;
      this.weightValue = this.roundWeight(converted);
    }
    this.weightUnit = unit;
  }

  onDateChange(value: string) {
    this.birthdayValue = value;
    if (!value) {
      this.selectedDate = null;
      this.ageLabel = '';
      return;
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      this.selectedDate = null;
      this.ageLabel = '';
      return;
    }
    const today = new Date();
    const maxDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (date > maxDate) {
      this.selectedDate = maxDate;
      this.birthdayValue = this.toDateInputValue(maxDate);
    } else {
      this.selectedDate = date;
    }
    this.updateAgeLabel();
  }

  async createPet() {
    this.showValidation = true;
    if (!this.isFormValid || !this.draft || !this.selectedDate) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const payload = {
        name: this.draft.name,
        species: this.draft.speciesCode as PetSpecies,
        breed: this.draft.breedCode || undefined,
        birthDate: this.selectedDate,
        weightKg: this.toKg(this.weightValue ?? 0, this.weightUnit),
      };

      const pet = await firstValueFrom(this.pets.createPet(payload));

      if (this.draft.imageDataUrl) {
        await this.uploadPhoto(pet.petId, this.draft.imageDataUrl);
      }

      this.state.clear();
      void this.router.navigate(['/']);
    } catch (error: any) {
      this.errorMessage = error?.message ?? this.i18n.t('errors.network');
    } finally {
      this.isSubmitting = false;
    }
  }

  private updateAgeLabel() {
    if (!this.selectedDate) {
      this.ageLabel = '';
      return;
    }

    const today = new Date();
    let years = today.getFullYear() - this.selectedDate.getFullYear();
    let months = today.getMonth() - this.selectedDate.getMonth();
    let days = today.getDate() - this.selectedDate.getDate();

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
      this.ageLabel = '';
      return;
    }

    const parts: string[] = [];
    if (years > 0) {
      parts.push(this.formatAgePart(years, 'year'));
    }
    if (months > 0) {
      parts.push(this.formatAgePart(months, 'month'));
    }
    if (years === 0 && months === 0) {
      parts.push(this.formatAgePart(Math.max(days, 0), 'day'));
    }

    this.ageLabel = parts.join(' ');
  }

  private formatAgePart(value: number, unit: 'year' | 'month' | 'day') {
    if (this.i18n.locale === 'es') {
      if (unit === 'year') {
        return `${value} ${value === 1 ? 'año' : 'años'}`;
      }
      if (unit === 'month') {
        return `${value} ${value === 1 ? 'mes' : 'meses'}`;
      }
      return `${value} ${value === 1 ? 'día' : 'días'}`;
    }

    if (unit === 'year') {
      return `${value} ${value === 1 ? 'year' : 'years'}`;
    }
    if (unit === 'month') {
      return `${value} ${value === 1 ? 'month' : 'months'}`;
    }
    return `${value} ${value === 1 ? 'day' : 'days'}`;
  }

  private roundWeight(value: number) {
    return Math.round(value * 100) / 100;
  }

  private toKg(value: number, unit: WeightUnit) {
    if (unit === 'kg') {
      return this.roundWeight(value);
    }
    return this.roundWeight(value * 0.45359237);
  }

  private async uploadPhoto(petId: string, dataUrl: string) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const contentType = blob.type || 'image/jpeg';

    const upload = await firstValueFrom(
      this.uploads.generatePhotoUploadUrl(petId, contentType),
    );

    const uploadResponse = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(this.i18n.t('errors.network'));
    }

    await firstValueFrom(this.pets.updatePet(petId, { photoKey: upload.fileKey }));
  }

  private getDefaultBirthday() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() - 2, today.getDate());
  }

  private toDateInputValue(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
