import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FeedingComponent } from './feeding.component';
import { PetEvent } from '@pettzi/domain-model';
import { EventsService } from '../../core/services/events.service';
import { RemindersService } from '../../core/services/reminders.service';
import { UploadsService } from '../../core/services/uploads.service';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';

describe('FeedingComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        FeedingComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [
        {
          provide: EventsService,
          useValue: {
            createPetEvent: jest.fn(() => of({ eventId: 'evt-1' })),
            listPetEvents: jest.fn(() =>
              of({
                events: [
                  {
                    eventId: 'evt-1',
                    petId: 'pet-1',
                    eventType: 'FEEDING',
                    eventDate: new Date(),
                    createdAt: new Date(),
                    title: 'Old Food',
                    metadata: { newFood: 'Old Food' },
                  } as unknown as PetEvent,
                ],
              })
            ),
          },
        },
        { provide: RemindersService, useValue: { createPetReminder: jest.fn(() => of({})) } },
        { provide: UploadsService, useValue: { generateDocumentUploadUrl: jest.fn() } },
      ],
    });
  });

  it('loads previous food when available', async () => {
    const fixture = TestBed.createComponent(FeedingComponent);
    const component = fixture.componentInstance;
    component.petId = 'pet-1';
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.previousFood).toBe('Old Food');
  });

  it('validates required fields and reminder time', () => {
    const fixture = TestBed.createComponent(FeedingComponent);
    const component = fixture.componentInstance;
    component.petId = 'pet-1';
    component.feedingDate = new Date();
    component.previousFood = 'Old Food';
    component.newFood = 'New Food';
    component.portion = '1 cup';
    component.mealTimes = 2;
    component.createReminder = true;
    component.firstReminderTime = '';
    expect(component.isFormValid).toBe(false);

    component.firstReminderTime = '08:00';
    expect(component.isFormValid).toBe(true);
  });
});
