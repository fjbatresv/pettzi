import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';
import { PetEvent } from '@pettzi/domain-model';

interface EventsListResponse {
  events: PetEvent[];
}

interface CreateEventRequest {
  eventType: 'VACCINE' | 'VET_VISIT' | 'MEDICATION' | 'WEIGHT' | 'GROOMING' | 'OTHER';
  date: string;
  title?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class EventsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listPetEvents(petId: string): Observable<EventsListResponse> {
    return this.http.get<EventsListResponse>(this.buildUrl(`/pets/${petId}`));
  }

  createPetEvent(petId: string, payload: CreateEventRequest): Observable<PetEvent> {
    return this.http.post<PetEvent>(this.buildUrl(`/pets/${petId}`), payload);
  }

  private buildUrl(path: string) {
    const base = this.baseUrl || '';
    const eventsBase = this.resolveEventsBase(base);
    return `${eventsBase}${path}`;
  }

  private resolveEventsBase(baseUrl: string) {
    if (!baseUrl) {
      return '/events';
    }

    if (baseUrl.includes('execute-api')) {
      return baseUrl.replace(/\/$/, '');
    }

    if (baseUrl.endsWith('/events')) {
      return baseUrl;
    }

    return `${baseUrl}/events`;
  }
}
