import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { Router } from '@angular/router';
import { PetCreateStep1Component } from './pet-create-step1.component';
import { CatalogsService } from '../../core/services/catalogs.service';
import { PetCreateStateService } from '../../core/services/pet-create-state.service';

describe('PetCreateStep1Component', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        PetCreateStep1Component,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [
        {
          provide: CatalogsService,
          useValue: {
            getSpecies: jest.fn(() => of({ species: [] })),
            getBreeds: jest.fn(() => of({ breeds: [] })),
          },
        },
        { provide: PetCreateStateService, useValue: { getDraft: jest.fn(), setDraft: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn() } },
      ],
    });
  });

  it('stores custom breed when no match exists', () => {
    const fixture = TestBed.createComponent(PetCreateStep1Component);
    const component = fixture.componentInstance;
    component.breeds = [{ code: 'LABRADOR', label: 'Labrador Retriever', speciesId: 'DOG' }];
    component.onBreedQueryChange('Custom Breed');
    expect(component.selectedBreedCode).toBe('Custom Breed');
  });

  it('uses code when a breed is selected from autocomplete', () => {
    const fixture = TestBed.createComponent(PetCreateStep1Component);
    const component = fixture.componentInstance;
    component.breeds = [{ code: 'LABRADOR', label: 'Labrador Retriever', speciesId: 'DOG' }];
    component.onBreedSelected('Labrador Retriever');
    expect(component.selectedBreedCode).toBe('LABRADOR');
  });

  it('keeps custom breed on blur', () => {
    const fixture = TestBed.createComponent(PetCreateStep1Component);
    const component = fixture.componentInstance;
    component.breeds = [];
    component.breedQuery = 'My Mix';
    component.onBreedBlur();
    expect(component.selectedBreedCode).toBe('My Mix');
    expect(component.breedQuery).toBe('My Mix');
  });
});
