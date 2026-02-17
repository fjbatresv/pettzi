import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateFakeLoader, TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { PetEditComponent } from './pet-edit.component';
import { PetsService } from '../../core/services/pets.service';
import { CatalogsService } from '../../core/services/catalogs.service';
import { UploadsService } from '../../core/services/uploads.service';

describe('PetEditComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        PetEditComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [
        { provide: PetsService, useValue: { listPets: jest.fn(() => of({ pets: [] })) } },
        {
          provide: CatalogsService,
          useValue: { getSpecies: jest.fn(() => of({ species: [] })), getBreeds: jest.fn(() => of({ breeds: [] })) },
        },
        { provide: UploadsService, useValue: { generateDownloadUrl: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map() } } },
        { provide: MatDialog, useValue: { open: jest.fn(() => ({ afterClosed: () => of(false) })) } },
        {
          provide: TranslateService,
          useValue: {
            currentLang: 'es',
            defaultLang: 'es',
            instant: (key: string) => key,
          },
        },
      ],
    });
  });

  it('stores custom breed when typed', () => {
    const fixture = TestBed.createComponent(PetEditComponent);
    const component = fixture.componentInstance;
    component.breeds = [{ code: 'LABRADOR', label: 'Labrador Retriever', speciesId: 'DOG' }];
    component.onBreedQueryChange('Mi raza');
    expect(component.breed).toBe('Mi raza');
  });

  it('uses code when selecting a breed from autocomplete', () => {
    const fixture = TestBed.createComponent(PetEditComponent);
    const component = fixture.componentInstance;
    component.breeds = [{ code: 'LABRADOR', label: 'Labrador Retriever', speciesId: 'DOG' }];
    component.onBreedSelected('Labrador Retriever');
    expect(component.breed).toBe('LABRADOR');
  });

  it('keeps custom breed on blur', () => {
    const fixture = TestBed.createComponent(PetEditComponent);
    const component = fixture.componentInstance;
    component.breeds = [];
    component.breedQuery = 'Custom';
    component.onBreedBlur();
    expect(component.breed).toBe('Custom');
    expect(component.breedQuery).toBe('Custom');
  });
});
