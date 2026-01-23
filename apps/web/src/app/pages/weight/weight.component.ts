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
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { EventsService } from '../../core/services/events.service';
import { PetsService } from '../../core/services/pets.service';

@Component({
  selector: 'app-weight',
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
    MatSelectModule,
    TranslateModule,
  ],
  templateUrl: './weight.component.html',
  styleUrl: './weight.component.scss',
})
export class WeightComponent {
  private readonly pets = inject(PetsService);
  private readonly events = inject(EventsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly activePetKey = 'pettzi.activePetId';

  petName = '';
  petId = '';
  weightValue: number | null = null;
  weightUnit: 'kg' | 'lb' = 'kg';
  weightDate: Date | null = null;
  observations = '';
  isSubmitting = false;
  private readonly weightUnitKey = 'pettzi.weightUnit';

  get maxWeightDate() {
    return this.startOfDay(new Date());
  }

  get isFormValid() {
    return (
      this.petId &&
      this.weightValue !== null &&
      this.weightValue > 0 &&
      !!this.weightDate
    );
  }

  ngOnInit() {
    this.weightUnit = this.getStoredUnit();
    const routePetId = this.route.snapshot.paramMap.get('petId') ?? '';
    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        const list = pets ?? [];
        const activeId = localStorage.getItem(this.activePetKey);
        const targetId = routePetId || activeId || '';
        const activePet = targetId ? list.find((pet) => pet.petId === targetId) : list[0];
        this.petName = activePet?.name ?? '';
        this.petId = activePet?.petId ?? '';
        if (this.petId) {
          localStorage.setItem(this.activePetKey, this.petId);
        }
      },
    });
  }

  async saveWeight() {
    if (!this.isFormValid || this.isSubmitting || !this.weightDate || this.weightValue === null) {
      return;
    }
    this.isSubmitting = true;
    try {
      const weightKg = this.toKg(this.weightValue);
      const payload = {
        eventType: 'WEIGHT' as const,
        date: this.weightDate.toISOString(),
        title: this.translate.instant('weight.eventTitle'),
        notes: this.observations.trim() || undefined,
        metadata: {
          weightKg,
          unit: this.weightUnit,
        },
      };
      await firstValueFrom(this.events.createPetEvent(this.petId, payload));
      if (weightKg !== null) {
        await firstValueFrom(this.pets.updatePet(this.petId, { weightKg }));
      }
      void this.router.navigate(['/pets', this.petId]);
    } catch {
      this.isSubmitting = false;
    }
  }

  private startOfDay(value: Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private toKg(value: number | null) {
    if (value === null) {
      return null;
    }
    if (this.weightUnit === 'kg') {
      return value;
    }
    return Math.round(value * 0.45359237 * 100) / 100;
  }

  private getStoredUnit(): 'kg' | 'lb' {
    const stored = localStorage.getItem(this.weightUnitKey);
    return stored === 'lb' ? 'lb' : 'kg';
  }
}
