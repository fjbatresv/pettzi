import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  PetRoutine,
  RoutineActivity,
  RoutineOccurrence,
  RoutineStatus,
  RoutineType,
} from '@pettzi/domain-model';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';

export interface RoutineOccurrenceExpanded extends RoutineOccurrence {
  activity: RoutineActivity;
  routine: PetRoutine;
}

export interface RoutineDetailResponse {
  routine: PetRoutine | null;
  activities: RoutineActivity[];
}

export interface UpsertRoutineRequest {
  timezone: string;
  status?: RoutineStatus;
}

export interface CreateRoutineActivityRequest {
  title: string;
  type: RoutineType;
  notes?: string;
  status?: RoutineStatus.ACTIVE | RoutineStatus.PAUSED;
  routineTimezone?: string;
  schedule: RoutineActivity['schedule'];
}

export type UpdateRoutineActivityRequest = Partial<
  Omit<CreateRoutineActivityRequest, 'routineTimezone'>
>;

@Injectable({ providedIn: 'root' })
export class RoutinesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getPetRoutine(petId: string): Observable<RoutineDetailResponse> {
    return this.http.get<RoutineDetailResponse>(this.buildUrl(`/pets/${petId}/routine`));
  }

  upsertPetRoutine(
    petId: string,
    payload: UpsertRoutineRequest
  ): Observable<PetRoutine> {
    return this.http.put<PetRoutine>(this.buildUrl(`/pets/${petId}/routine`), payload);
  }

  createRoutineActivity(
    petId: string,
    payload: CreateRoutineActivityRequest
  ): Observable<RoutineActivity> {
    return this.http.post<RoutineActivity>(
      this.buildUrl(`/pets/${petId}/routine/activities`),
      payload
    );
  }

  updateRoutineActivity(
    petId: string,
    activityId: string,
    payload: UpdateRoutineActivityRequest
  ): Observable<RoutineActivity> {
    return this.http.patch<RoutineActivity>(
      this.buildUrl(`/pets/${petId}/routine/activities/${activityId}`),
      payload
    );
  }

  deleteRoutineActivity(
    petId: string,
    activityId: string
  ): Observable<{ message?: string }> {
    return this.http.delete<{ message?: string }>(
      this.buildUrl(`/pets/${petId}/routine/activities/${activityId}`)
    );
  }

  listToday(
    petId: string
  ): Observable<{ occurrences: RoutineOccurrenceExpanded[] }> {
    return this.http.get<{ occurrences: RoutineOccurrenceExpanded[] }>(
      this.buildUrl(`/pets/${petId}/routine/today`)
    );
  }

  listHistory(
    petId: string
  ): Observable<{ occurrences: RoutineOccurrenceExpanded[] }> {
    return this.http.get<{ occurrences: RoutineOccurrenceExpanded[] }>(
      this.buildUrl(`/pets/${petId}/routine/history`)
    );
  }

  completeOccurrence(
    petId: string,
    occurrenceId: string,
    notes?: string
  ): Observable<RoutineOccurrence> {
    return this.http.post<RoutineOccurrence>(
      this.buildUrl(`/pets/${petId}/routine/occurrences/${occurrenceId}/complete`),
      notes ? { notes } : {}
    );
  }

  skipOccurrence(
    petId: string,
    occurrenceId: string,
    notes?: string
  ): Observable<RoutineOccurrence> {
    return this.http.post<RoutineOccurrence>(
      this.buildUrl(`/pets/${petId}/routine/occurrences/${occurrenceId}/skip`),
      notes ? { notes } : {}
    );
  }

  private buildUrl(path: string) {
    const base = this.baseUrl || '';
    const routinesBase = this.resolveRoutinesBase(base);
    return `${routinesBase}${path}`;
  }

  private resolveRoutinesBase(baseUrl: string) {
    if (!baseUrl) {
      return '/routines';
    }

    if (baseUrl.includes('execute-api')) {
      return baseUrl.replace(/\/$/, '');
    }

    if (baseUrl.endsWith('/routines')) {
      return baseUrl;
    }

    return `${baseUrl}/routines`;
  }
}
