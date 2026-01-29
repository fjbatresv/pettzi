import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { WalkComponent } from './walk.component';
import { EventsService } from '../../core/services/events.service';
import { UploadsService } from '../../core/services/uploads.service';
import { TranslateService } from '@ngx-translate/core';

describe('WalkComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WalkComponent],
      providers: [
        { provide: EventsService, useValue: { createPetEvent: jest.fn(() => of({})) } },
        { provide: UploadsService, useValue: { generateDocumentUploadUrl: jest.fn() } },
        { provide: TranslateService, useValue: { instant: jest.fn((key: string) => key) } },
      ],
    });
  });

  it('requires duration and distance', () => {
    const fixture = TestBed.createComponent(WalkComponent);
    const component = fixture.componentInstance;
    component.petId = 'pet-1';
    component.walkDate = new Date();
    component.durationMinutes = 0;
    component.distanceKm = 0;
    expect(component.isFormValid).toBe(false);

    component.durationMinutes = 30;
    component.distanceKm = 2;
    expect(component.isFormValid).toBe(true);
  });
});
