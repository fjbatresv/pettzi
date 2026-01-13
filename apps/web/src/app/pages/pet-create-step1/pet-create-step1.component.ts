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
import { CreateHeaderComponent } from '../../components/create-header/create-header.component';

@Component({
  selector: 'app-pet-create-step1',
  imports: [
    CommonModule,
    CreateHeaderComponent,
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
    const local = this.state.getDraft();
    if (local) {
      this.name = local.name;
      this.imageUrl = local.imageDataUrl ?? '';
    }
    this.catalogs.getSpecies().subscribe({
      next: ({ species }) => {
        this.speciesOptions = species ?? [];
        const preferredSpeciesCode = local?.speciesCode;
        this.selectedSpeciesCode =
          preferredSpeciesCode &&
          this.speciesOptions.some((item) => item.code === preferredSpeciesCode)
            ? preferredSpeciesCode
            : this.speciesOptions[0]?.code ?? '';
        if (this.selectedSpeciesCode) {
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
    this.state.setDraft({
      name: this.name.trim(),
      speciesCode: this.selectedSpeciesCode,
      breedCode: this.selectedBreedCode,
      imageDataUrl: this.imageUrl || undefined,
    });
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
}
