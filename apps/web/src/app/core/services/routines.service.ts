import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  RoutineDefinition,
  RoutineOccurrence,
  RoutineStatus,
  RoutineType,
} from '@pettzi/domain-model';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';

export interface RoutineOccurrenceExpanded extends RoutineOccurrence {
  routine: RoutineDefinition;
}

export interface CreateRoutineRequest {
  title: string;
  type: RoutineType;
  notes?: string;
  timezone: string;
  schedule: RoutineDefinition['schedule'];
}

export interface UpdateRoutineRequest extends Partial<CreateRoutineRequest> {
  status?: RoutineStatus;
}

@Injectable({ providedIn: 'root' })
export class RoutinesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listPetRoutines(petId: string): Observable<{ routines: RoutineDefinition[] }> {
    return this.http.get<{ routines: RoutineDefinition[] }>(
      this.buildUrl(`/pets/${petId}/routines`)
    );
  }

  createPetRoutine(
    petId: string,
    payload: CreateRoutineRequest
  ): Observable<RoutineDefinition> {
    return this.http.post<RoutineDefinition>(
      this.buildUrl(`/pets/${petId}/routines`),
      payload
    );
  }

  updatePetRoutine(
    petId: string,
    routineId: string,
    payload: UpdateRoutineRequest
  ): Observable<RoutineDefinition> {
    return this.http.patch<RoutineDefinition>(
      this.buildUrl(`/pets/${petId}/routines/${routineId}`),
      payload
    );
  }

  deletePetRoutine(
    petId: string,
    routineId: string
  ): Observable<{ message?: string }> {
    return this.http.delete<{ message?: string }>(
      this.buildUrl(`/pets/${petId}/routines/${routineId}`)
    );
  }

  listUpcoming(
    petId: string
  ): Observable<{ occurrences: RoutineOccurrenceExpanded[] }> {
    return this.http.get<{ occurrences: RoutineOccurrenceExpanded[] }>(
      this.buildUrl(`/pets/${petId}/routines/upcoming`)
    );
  }

  listHistory(
    petId: string
  ): Observable<{ occurrences: RoutineOccurrenceExpanded[] }> {
    return this.http.get<{ occurrences: RoutineOccurrenceExpanded[] }>(
      this.buildUrl(`/pets/${petId}/routines/history`)
    );
  }

  completeOccurrence(
    petId: string,
    occurrenceId: string,
    notes?: string
  ): Observable<RoutineOccurrence> {
    return this.http.post<RoutineOccurrence>(
      this.buildUrl(`/pets/${petId}/routines/occurrences/${occurrenceId}/complete`),
      notes ? { notes } : {}
    );
  }

  skipOccurrence(
    petId: string,
    occurrenceId: string,
    notes?: string
  ): Observable<RoutineOccurrence> {
    return this.http.post<RoutineOccurrence>(
      this.buildUrl(`/pets/${petId}/routines/occurrences/${occurrenceId}/skip`),
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
