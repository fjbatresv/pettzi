import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Pet, PetSpecies } from '@pettzi/domain-model';
import { firstValueFrom } from 'rxjs';
import { PetsService } from '../../core/services/pets.service';
import { BreedItem, CatalogsService, SpeciesItem } from '../../core/services/catalogs.service';
import { UploadsService } from '../../core/services/uploads.service';
import { DeletePetDialogComponent } from './delete-pet-dialog.component';

@Component({
  selector: 'app-pet-edit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    TranslateModule,
  ],
  templateUrl: './pet-edit.component.html',
  styleUrl: './pet-edit.component.scss',
})
export class PetEditComponent implements OnInit {
  private readonly pets = inject(PetsService);
  private readonly catalogs = inject(CatalogsService);
  private readonly uploads = inject(UploadsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly activePetKey = 'pettzi.activePetId';
  private readonly chipPrefix = 'Chip: ';
  private readonly confirmWords = [
    'BORRAR',
    'ELIMINAR',
    'PETTZI',
    'MASCOTA',
    'SEGURIDAD',
  ];

  pet: Pet | null = null;
  speciesOptions: SpeciesItem[] = [];
  breeds: BreedItem[] = [];
  filteredBreeds: BreedItem[] = [];
  petId = '';
  name = '';
  species: PetSpecies | '' = '';
  breed = '';
  breedQuery = '';
  birthDate: Date | null = null;
  color = '';
  sex = '';
  isNeutered = false;
  bloodType = '';
  petPhotoUrl = '';
  chipId = '';
  observations = '';
  isSubmitting = false;
  photoUploading = false;

  get isFormValid() {
    return !!this.petId && !this.isSubmitting;
  }

  get birthDateLabel() {
    if (!this.birthDate) {
      return '';
    }
    return this.birthDate.toLocaleDateString(this.getLocale(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  get speciesLabel() {
    const match = this.speciesOptions.find((item) => item.code === this.species);
    return match?.label || this.species;
  }

  ngOnInit() {
    const routePetId = this.route.snapshot.paramMap.get('petId') ?? '';
    this.catalogs.getSpecies().subscribe({
      next: ({ species }) => {
        this.speciesOptions = species ?? [];
        if (this.species) {
          this.loadBreeds(this.species, this.breed);
        }
      },
    });

    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        const list = pets ?? [];
        if (!list.length) {
          void this.router.navigate(['/pets/new']);
          return;
        }
        const activeId = localStorage.getItem(this.activePetKey);
        const targetId = routePetId || activeId || '';
        const activePet = targetId ? list.find((pet) => pet.petId === targetId) : list[0];
        this.pet = activePet ?? null;
        if (!this.pet) {
          return;
        }
        this.petId = this.pet.petId;
        localStorage.setItem(this.activePetKey, this.petId);
        this.name = this.pet.name || '';
        this.species = this.pet.species || '';
        this.breed = this.pet.breed || '';
        this.birthDate = this.pet.birthDate ? new Date(this.pet.birthDate as unknown as string) : null;
        this.color = this.pet.color || '';
        this.sex = this.pet.sex || '';
        this.isNeutered = this.pet.isNeutered ?? false;
        this.bloodType = this.pet.bloodType || '';
        const parsed = this.parseNotes(this.pet.notes);
        this.chipId = parsed.chipId;
        this.observations = parsed.observations;
        const photoKey = this.pet.photoThumbnailKey ?? this.pet.photoKey;
        if (photoKey) {
          this.loadPhoto(this.pet.petId, photoKey);
        }
        if (this.species) {
          this.loadBreeds(this.species, this.breed);
        }
      },
    });
  }

  async onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.petId || this.photoUploading) {
      return;
    }

    this.photoUploading = true;
    try {
      const contentType = file.type || 'image/jpeg';
      const upload = await firstValueFrom(
        this.uploads.generatePhotoUploadUrl(this.petId, contentType)
      );

      const uploadResponse = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(this.translate.instant('errors.network'));
      }

      await firstValueFrom(this.pets.updatePet(this.petId, { photoKey: upload.fileKey }));
      await this.loadPhoto(this.petId, upload.fileKey);
    } catch {
      // keep current photo when upload fails
    } finally {
      this.photoUploading = false;
      input.value = '';
    }
  }

  async saveProfile() {
    if (!this.isFormValid) {
      return;
    }

    this.isSubmitting = true;
    const notes = this.buildNotes();

    this.pets
      .updatePet(this.petId, {
        species: this.species || undefined,
        breed: this.breed.trim() || undefined,
        color: this.color.trim() || undefined,
        sex: this.sex || undefined,
        isNeutered: this.isNeutered,
        bloodType: this.bloodType.trim() || undefined,
        notes: notes || undefined,
      })
      .subscribe({
        next: () => {
          void this.router.navigate(['/pets', this.petId]);
        },
        error: () => {
          this.isSubmitting = false;
        },
      });
  }

  async requestDelete() {
    if (!this.petId) {
      return;
    }
    const word = this.getRandomWord();
    const ref = this.dialog.open(DeletePetDialogComponent, {
      data: {
        word,
        petName: this.name,
      },
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) {
      return;
    }
    try {
      await firstValueFrom(this.pets.deletePet(this.petId));
      const next = await firstValueFrom(this.pets.listPetsFresh());
      const list = next.pets ?? [];
      if (list.length > 0) {
        localStorage.setItem(this.activePetKey, list[0]?.petId ?? '');
        void this.router.navigate(['/pets', this.petId]);
      } else {
        localStorage.removeItem(this.activePetKey);
        void this.router.navigate(['/pets/new']);
      }
    } catch {
      // keep user on page if deletion fails
    }
  }

  private buildNotes() {
    const chip = this.chipId.trim();
    const observations = this.observations.trim();
    if (chip && observations) {
      return `${this.chipPrefix}${chip}\n\n${observations}`;
    }
    if (chip) {
      return `${this.chipPrefix}${chip}`;
    }
    return observations;
  }

  private parseNotes(notes?: string) {
    if (!notes) {
      return { chipId: '', observations: '' };
    }

    if (notes.startsWith(this.chipPrefix)) {
      const rest = notes.slice(this.chipPrefix.length);
      const [chipLine, ...restLines] = rest.split('\n');
      return {
        chipId: chipLine.trim(),
        observations: restLines.join('\n').trim(),
      };
    }

    return { chipId: '', observations: notes };
  }

  private getRandomWord() {
    const index = Math.floor(Math.random() * this.confirmWords.length);
    return this.confirmWords[index] ?? 'PETTZI';
  }

  private async loadPhoto(petId: string, fileKey: string) {
    const result = await firstValueFrom(this.uploads.generateDownloadUrl(petId, fileKey));
    this.petPhotoUrl = result?.downloadUrl || '';
  }

  onSpeciesChange(value: PetSpecies) {
    this.species = value;
    this.loadBreeds(value);
  }

  onBreedQueryChange(value: string) {
    this.breedQuery = value;
    this.updateFilteredBreeds(value);
  }

  onBreedSelected(label: string) {
    const match = this.findBreedByLabel(label);
    this.breed = match?.code ?? '';
    this.breedQuery = match?.label ?? label;
  }

  onBreedBlur() {
    if (!this.breedQuery.trim()) {
      this.breed = '';
      return;
    }
    const match = this.findBreedByLabel(this.breedQuery);
    if (match) {
      this.breed = match.code;
      this.breedQuery = match.label;
      return;
    }
    this.syncBreedQuery();
  }

  private loadBreeds(speciesCode: string, preferredBreedCode?: string) {
    this.catalogs.getBreeds(speciesCode).subscribe({
      next: ({ breeds }) => {
        this.breeds = breeds ?? [];
        this.breed =
          preferredBreedCode &&
          this.breeds.some((item) => item.code === preferredBreedCode)
            ? preferredBreedCode
            : this.breeds[0]?.code ?? '';
        this.syncBreedQuery();
        this.updateFilteredBreeds('');
      },
      error: () => {
        this.breeds = [];
        this.breed = '';
        this.breedQuery = '';
        this.filteredBreeds = [];
      },
    });
  }

  private getLocale() {
    return this.translate.currentLang || this.translate.defaultLang || 'es';
  }

  private syncBreedQuery() {
    const match = this.breeds.find((item) => item.code === this.breed);
    this.breedQuery = match?.label ?? '';
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
