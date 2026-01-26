import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule } from '@ngx-translate/core';
import {
  CatalogsService,
  SpeciesItem,
  BreedItem,
} from '../../core/services/catalogs.service';
import { PetCreateStateService } from '../../core/services/pet-create-state.service';

@Component({
  selector: 'app-pet-create-step1',
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    TranslateModule,
  ],
  standalone: true,
  templateUrl: './pet-create-step1.component.html',
  styleUrl: './pet-create-step1.component.scss',
})
export class PetCreateStep1Component implements OnInit {
  private readonly catalogs = inject(CatalogsService);
  private readonly state = inject(PetCreateStateService);
  private readonly router = inject(Router);
  private readonly draftStorageKey = 'petCreateDraft';

  imageUrl = '';
  currentYear = new Date().getFullYear();
  name = '';
  speciesOptions: SpeciesItem[] = [];
  breeds: BreedItem[] = [];
  selectedSpeciesCode = '';
  selectedBreedCode = '';
  showValidation = false;

  get isFormValid() {
    return this.name.trim().length > 0 && this.selectedBreedCode.length > 0;
  }

  ngOnInit() {
    const local = this.restoreDraft();
    this.catalogs.getSpecies().subscribe({
      next: ({ species }) => {
        this.speciesOptions = species ?? [];
        const preferredSpeciesCode = local?.speciesCode;
        if (this.speciesOptions.length > 0) {
          this.selectedSpeciesCode =
            preferredSpeciesCode &&
            this.speciesOptions.some((item) => item.code === preferredSpeciesCode)
              ? preferredSpeciesCode
              : this.speciesOptions[0]?.code ?? '';
        }
        if (this.selectedSpeciesCode && this.speciesOptions.length > 0) {
          this.loadBreeds(this.selectedSpeciesCode, local?.breedCode);
        }
      },
      error: () => {
        this.speciesOptions = [];
      },
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      this.imageUrl = typeof result === 'string' ? result : '';
    };
    reader.readAsDataURL(file);
  }

  onSpeciesChange(value: string) {
    this.selectedSpeciesCode = value;
    this.loadBreeds(value);
  }

  continue() {
    if (!this.isFormValid) {
      this.showValidation = true;
      return;
    }
    const draft = {
      name: this.name.trim(),
      speciesCode: this.selectedSpeciesCode,
      breedCode: this.selectedBreedCode,
      imageDataUrl: this.imageUrl || undefined,
    };
    this.state.setDraft(draft);
    const persistedDraft = {
      name: draft.name,
      speciesCode: draft.speciesCode,
      breedCode: draft.breedCode,
    };
    try {
      sessionStorage.setItem(
        this.draftStorageKey,
        JSON.stringify(persistedDraft)
      );
    } catch {
      try {
        sessionStorage.removeItem(this.draftStorageKey);
        sessionStorage.setItem(
          this.draftStorageKey,
          JSON.stringify(persistedDraft)
        );
      } catch {
        // Ignore storage failures (e.g., quota exceeded) and rely on in-memory draft.
      }
    }
    void this.router.navigate(['/pets/new/details']);
  }

  private loadBreeds(speciesCode: string, preferredBreedCode?: string) {
    this.catalogs.getBreeds(speciesCode).subscribe({
      next: ({ breeds }) => {
        this.breeds = breeds ?? [];
        this.selectedBreedCode =
          preferredBreedCode &&
          this.breeds.some((item) => item.code === preferredBreedCode)
            ? preferredBreedCode
            : this.breeds[0]?.code ?? '';
      },
      error: () => {
        this.breeds = [];
        this.selectedBreedCode = '';
      },
    });
  }

  private restoreDraft() {
    const stored = this.readDraftFromStorage();
    const draft = this.state.getDraft();
    if (!stored && !draft) {
      return null;
    }

    const normalized = {
      name: stored?.name ?? draft?.name ?? '',
      speciesCode: stored?.speciesCode ?? draft?.speciesCode ?? '',
      breedCode: stored?.breedCode ?? draft?.breedCode ?? '',
      imageDataUrl: draft?.imageDataUrl ?? undefined,
    };
    if (
      !normalized.name &&
      !normalized.speciesCode &&
      !normalized.breedCode &&
      !normalized.imageDataUrl
    ) {
      return null;
    }

    this.state.setDraft(normalized);
    this.name = normalized.name;
    this.imageUrl = normalized.imageDataUrl ?? '';
    this.selectedSpeciesCode = normalized.speciesCode;
    this.selectedBreedCode = normalized.breedCode;

    return normalized;
  }

  private readDraftFromStorage() {
    const raw = sessionStorage.getItem(this.draftStorageKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<{
        name: string;
        speciesCode: string;
        breedCode: string;
      }>;

      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      return {
        name: typeof parsed.name === 'string' ? parsed.name : '',
        speciesCode: typeof parsed.speciesCode === 'string' ? parsed.speciesCode : '',
        breedCode: typeof parsed.breedCode === 'string' ? parsed.breedCode : '',
      };
    } catch {
      return null;
    }
  }
}
