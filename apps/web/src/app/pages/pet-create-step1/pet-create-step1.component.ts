import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
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
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
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
  filteredBreeds: BreedItem[] = [];
  selectedSpeciesCode = '';
  selectedBreedCode = '';
  breedQuery = '';
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

  onBreedQueryChange(value: string) {
    const trimmed = value.trim();
    this.breedQuery = value;
    const match = this.findBreedByLabel(trimmed);
    this.selectedBreedCode = match?.code ?? trimmed;
    this.updateFilteredBreeds(value);
  }

  onBreedSelected(label: string) {
    const match = this.findBreedByLabel(label);
    this.selectedBreedCode = match?.code ?? label.trim();
    this.breedQuery = match?.label ?? label;
  }

  onBreedBlur() {
    const trimmed = this.breedQuery.trim();
    if (!trimmed) {
      this.selectedBreedCode = '';
      return;
    }
    const match = this.findBreedByLabel(trimmed);
    if (match) {
      this.selectedBreedCode = match.code;
      this.breedQuery = match.label;
      return;
    }
    this.selectedBreedCode = trimmed;
    this.breedQuery = trimmed;
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
        const preferred = preferredBreedCode?.trim();
        if (preferred) {
          const match = this.breeds.find((item) => item.code === preferred);
          if (match) {
            this.selectedBreedCode = match.code;
            this.breedQuery = match.label;
          } else {
            this.selectedBreedCode = preferred;
            this.breedQuery = preferred;
          }
        } else {
          this.selectedBreedCode = this.breeds[0]?.code ?? '';
          this.syncBreedQuery();
        }
        this.updateFilteredBreeds('');
      },
      error: () => {
        this.breeds = [];
        this.selectedBreedCode = '';
        this.breedQuery = '';
        this.filteredBreeds = [];
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

  private syncBreedQuery() {
    const match = this.breeds.find((item) => item.code === this.selectedBreedCode);
    this.breedQuery = match?.label ?? this.selectedBreedCode;
  }

  private updateFilteredBreeds(query: string) {
    const normalized = query.trim().toLowerCase();
    this.filteredBreeds = normalized
      ? this.breeds.filter((item) => item.label.toLowerCase().includes(normalized))
      : [...this.breeds];
  }

  private findBreedByLabel(label: string) {
    const normalized = label.trim().toLowerCase();
    return this.breeds.find((item) => item.label.toLowerCase() === normalized);
  }
}
