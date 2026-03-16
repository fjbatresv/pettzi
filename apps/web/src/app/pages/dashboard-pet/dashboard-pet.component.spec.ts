import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  RoutineStatus,
  RoutineType,
} from '@pettzi/domain-model';
import { DashboardPetComponent } from './dashboard-pet.component';
import { PetsService } from '../../core/services/pets.service';
import { UploadsService } from '../../core/services/uploads.service';
import { EventsService } from '../../core/services/events.service';
import { RemindersService } from '../../core/services/reminders.service';
import { CatalogsService } from '../../core/services/catalogs.service';
import { OwnersService } from '../../core/services/owners.service';
import { AuthService } from '../../core/services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { RoutinesService } from '../../core/services/routines.service';

describe('DashboardPetComponent', () => {
  const routinesService = {
    getPetRoutine: jest.fn(() =>
      of({
        routine: {
          routineId: 'pet-1',
          petId: 'pet-1',
          ownerUserId: 'owner-1',
          status: RoutineStatus.ACTIVE,
          timezone: 'America/Guatemala',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        activities: [
          {
            activityId: 'act-1',
            routineId: 'pet-1',
            petId: 'pet-1',
            ownerUserId: 'owner-1',
            title: 'Morning walk',
            type: RoutineType.WALKING,
            status: RoutineStatus.ACTIVE,
            schedule: { frequency: 'DAILY', times: ['07:00'] },
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          },
        ],
      })
    ),
    listToday: jest.fn(() =>
      of({
        occurrences: [
          {
            occurrenceId: 'occ-1',
            routineId: 'pet-1',
            activityId: 'act-1',
            petId: 'pet-1',
            scheduledFor: new Date('2026-01-02T07:00:00.000Z'),
            status: 'PENDING',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            routine: {
              routineId: 'pet-1',
              petId: 'pet-1',
              ownerUserId: 'owner-1',
              status: RoutineStatus.ACTIVE,
              timezone: 'America/Guatemala',
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            },
            activity: {
              activityId: 'act-1',
              routineId: 'pet-1',
              petId: 'pet-1',
              ownerUserId: 'owner-1',
              title: 'Morning walk',
              type: RoutineType.WALKING,
              status: RoutineStatus.ACTIVE,
              schedule: { frequency: 'DAILY', times: ['07:00'] },
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              updatedAt: new Date('2026-01-01T00:00:00.000Z'),
            },
          },
        ],
      })
    ),
    listHistory: jest.fn(() => of({ occurrences: [] })),
    createRoutineActivity: jest.fn(() => of({})),
    updateRoutineActivity: jest.fn(() => of({})),
    deleteRoutineActivity: jest.fn(() => of({})),
    upsertPetRoutine: jest.fn(() => of({})),
    completeOccurrence: jest.fn(() => of({})),
    skipOccurrence: jest.fn(() => of({})),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DashboardPetComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [
        {
          provide: PetsService,
          useValue: {
            listPets: jest.fn(() =>
              of({
                pets: [
                  {
                    petId: 'pet-1',
                    name: 'Luna',
                    species: 'DOG',
                    createdAt: new Date('2026-01-01T00:00:00.000Z'),
                  },
                ],
              })
            ),
            listPetsFresh: jest.fn(() => of({ pets: [] })),
          },
        },
        { provide: UploadsService, useValue: { generateDownloadUrl: jest.fn(() => of({ downloadUrl: '' })) } },
        { provide: EventsService, useValue: { listPetEvents: jest.fn(() => of({ events: [], nextCursor: '' })) } },
        { provide: RemindersService, useValue: { listPetReminders: jest.fn(() => of({ reminders: [] })) } },
        { provide: CatalogsService, useValue: { getSpecies: jest.fn(() => of({ species: [] })), getBreeds: jest.fn(() => of({ breeds: [] })) } },
        { provide: OwnersService, useValue: { listPetOwners: jest.fn(() => of({ owners: [] })) } },
        { provide: AuthService, useValue: { currentUser: jest.fn(() => ({ email: 'owner-1' })), getIdToken: jest.fn(async () => '') } },
        { provide: MatDialog, useValue: { open: jest.fn() } },
        { provide: Router, useValue: { navigate: jest.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'pet-1' } } } },
        { provide: RoutinesService, useValue: routinesService },
      ],
    }).compileComponents();
  });

  it('loads the routine detail for the active pet', async () => {
    const fixture = TestBed.createComponent(DashboardPetComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(routinesService.getPetRoutine).toHaveBeenCalledWith('pet-1');
    expect(fixture.componentInstance.routineActivities[0]?.title).toBe('Morning walk');
  });

  it('completes a routine occurrence', async () => {
    const fixture = TestBed.createComponent(DashboardPetComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.completeRoutineOccurrence(
      fixture.componentInstance.routineTodayList[0]
    );

    expect(routinesService.completeOccurrence).toHaveBeenCalledWith('pet-1', 'occ-1');
  });
});
