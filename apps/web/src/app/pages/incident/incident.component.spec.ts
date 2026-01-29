import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { IncidentComponent } from './incident.component';
import { EventsService } from '../../core/services/events.service';
import { UploadsService } from '../../core/services/uploads.service';
import { TranslateService } from '@ngx-translate/core';

describe('IncidentComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [IncidentComponent],
      providers: [
        { provide: EventsService, useValue: { createPetEvent: jest.fn(() => of({})) } },
        { provide: UploadsService, useValue: { generateDocumentUploadUrl: jest.fn() } },
        { provide: TranslateService, useValue: { instant: jest.fn((key: string) => key) } },
      ],
    });
  });

  it('validates required fields', () => {
    const fixture = TestBed.createComponent(IncidentComponent);
    const component = fixture.componentInstance;
    component.petId = 'pet-1';
    component.incidentName = '';
    component.incidentDate = new Date();
    expect(component.isFormValid).toBe(false);

    component.incidentName = 'Corte en pata';
    expect(component.isFormValid).toBe(true);
  });
});
