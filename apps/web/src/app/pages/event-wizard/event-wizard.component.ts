import { CommonModule } from '@angular/common';
import { Component, ViewChild, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PetsService } from '../../core/services/pets.service';
import { GroomingComponent } from '../grooming/grooming.component';
import { VetVisitComponent } from '../vet-visit/vet-visit.component';
import { MedicationComponent } from '../medication/medication.component';
import { VaccineComponent } from '../vaccine/vaccine.component';
import { WeightComponent } from '../weight/weight.component';
import { IncidentComponent } from '../incident/incident.component';
import { WalkComponent } from '../walk/walk.component';
import { FeedingComponent } from '../feeding/feeding.component';

type EventType =
  | 'WEIGHT'
  | 'VACCINE'
  | 'MEDICATION'
  | 'VET_VISIT'
  | 'GROOMING'
  | 'INCIDENT'
  | 'WALK'
  | 'FEEDING';

type EventTypeGroup = {
  id: string;
  labelKey: string;
  types: EventType[];
};

const EVENT_ICONS: Record<EventType, string> = {
  WEIGHT: 'monitor_weight',
  VACCINE: 'vaccines',
  MEDICATION: 'medical_services',
  VET_VISIT: 'local_hospital',
  GROOMING: 'spa',
  INCIDENT: 'report',
  WALK: 'directions_walk',
  FEEDING: 'restaurant',
};

const EVENT_TYPE_GROUPS: EventTypeGroup[] = [
  {
    id: 'health',
    labelKey: 'eventWizard.groupHealth',
    types: ['INCIDENT', 'VET_VISIT', 'VACCINE', 'MEDICATION', 'WEIGHT'],
  },
  {
    id: 'wellness',
    labelKey: 'eventWizard.groupWellness',
    types: ['GROOMING', 'FEEDING'],
  },
  {
    id: 'activity',
    labelKey: 'eventWizard.groupActivity',
    types: ['WALK'],
  },
];

@Component({
  selector: 'app-event-wizard',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    TranslateModule,
    GroomingComponent,
    VetVisitComponent,
    MedicationComponent,
    VaccineComponent,
    WeightComponent,
    IncidentComponent,
    WalkComponent,
    FeedingComponent,
  ],
  templateUrl: './event-wizard.component.html',
  styleUrl: './event-wizard.component.scss',
})
export class EventWizardComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pets = inject(PetsService);
  private readonly translate = inject(TranslateService);

  petId = '';
  petName = '';
  step: 1 | 2 = 1;
  searchQuery = '';
  selectedType: EventType | null = null;

  @ViewChild('groomingForm') groomingForm?: GroomingComponent;
  @ViewChild('vetVisitForm') vetVisitForm?: VetVisitComponent;
  @ViewChild('medicationForm') medicationForm?: MedicationComponent;
  @ViewChild('vaccineForm') vaccineForm?: VaccineComponent;
  @ViewChild('weightForm') weightForm?: WeightComponent;
  @ViewChild('incidentForm') incidentForm?: IncidentComponent;
  @ViewChild('walkForm') walkForm?: WalkComponent;
  @ViewChild('feedingForm') feedingForm?: FeedingComponent;

  ngOnInit() {
    this.petId = this.route.snapshot.paramMap.get('petId') ?? '';
    this.loadPetName();
  }

  get eventTypeGroups(): EventTypeGroup[] {
    const query = this.searchQuery.trim().toLowerCase();
    return EVENT_TYPE_GROUPS.map((group) => {
      const types = query
        ? group.types.filter((type) => this.getTypeLabel(type).toLowerCase().includes(query))
        : group.types;
      return { ...group, types };
    }).filter((group) => group.types.length > 0);
  }

  get stepLabel() {
    return this.translate.instant('eventWizard.stepLabel', { step: this.step, total: 2 });
  }

  onSearch(event: KeyboardEvent) {
    const target = event.target as HTMLInputElement | null;
    this.searchQuery = target?.value ?? '';
  }

  selectType(type: EventType) {
    this.selectedType = type;
  }

  goNext() {
    if (!this.selectedType) {
      return;
    }
    this.step = 2;
  }

  goBack() {
    this.searchQuery = '';
    this.step = 1;
  }

  cancel() {
    if (this.petId) {
      void this.router.navigate(['/pets', this.petId]);
      return;
    }
    void this.router.navigate(['/home']);
  }

  submitCurrentForm() {
    const form = this.currentForm;
    if (!form) {
      return;
    }
    form.submit();
  }

  handleSaved() {
    if (this.petId) {
      void this.router.navigate(['/pets', this.petId]);
      return;
    }
    void this.router.navigate(['/home']);
  }

  get canSave() {
    const form = this.currentForm;
    if (!form) {
      return false;
    }
    return form.isFormValid && !form.isSubmitting;
  }

  getTypeLabel(type: EventType) {
    switch (type) {
      case 'WEIGHT':
        return this.translate.instant('dashboard.activityWeight');
      case 'VACCINE':
        return this.translate.instant('dashboard.activityVaccine');
      case 'MEDICATION':
        return this.translate.instant('dashboard.activityMedication');
      case 'VET_VISIT':
        return this.translate.instant('dashboard.activityVetVisit');
      case 'GROOMING':
        return this.translate.instant('dashboard.activityGrooming');
      case 'INCIDENT':
        return this.translate.instant('dashboard.activityIncident');
      case 'WALK':
        return this.translate.instant('dashboard.activityWalk');
      case 'FEEDING':
        return this.translate.instant('dashboard.activityFeeding');
    }
  }

  getTypeIcon(type: EventType) {
    return EVENT_ICONS[type] ?? 'pets';
  }

  private loadPetName() {
    if (!this.petId) {
      return;
    }
    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        const match = (pets ?? []).find((pet) => pet.petId === this.petId);
        this.petName = match?.name ?? '';
      },
    });
  }

  private get currentForm() {
    switch (this.selectedType) {
      case 'GROOMING':
        return this.groomingForm;
      case 'VET_VISIT':
        return this.vetVisitForm;
      case 'MEDICATION':
        return this.medicationForm;
      case 'VACCINE':
        return this.vaccineForm;
      case 'WEIGHT':
        return this.weightForm;
      case 'INCIDENT':
        return this.incidentForm;
      case 'WALK':
        return this.walkForm;
      case 'FEEDING':
        return this.feedingForm;
      default:
        return undefined;
    }
  }
}
