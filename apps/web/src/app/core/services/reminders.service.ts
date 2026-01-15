import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';
import { PetReminder } from '@pettzi/domain-model';

interface RemindersListResponse {
  reminders: PetReminder[];
}

interface CreateReminderRequest {
  dueDate: string;
  message?: string;
  eventId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class RemindersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listPetReminders(petId: string, fromDate?: Date, toDate?: Date): Observable<RemindersListResponse> {
    let params = new HttpParams();
    if (fromDate) {
      params = params.set('fromDate', fromDate.toISOString());
    }
    if (toDate) {
      params = params.set('toDate', toDate.toISOString());
    }

    return this.http.get<RemindersListResponse>(this.buildUrl(`/pets/${petId}`), {
      params,
    });
  }

  createPetReminder(petId: string, payload: CreateReminderRequest): Observable<PetReminder> {
    return this.http.post<PetReminder>(this.buildUrl(`/pets/${petId}`), payload);
  }

  private buildUrl(path: string) {
    const base = this.baseUrl || '';
    const remindersBase = this.resolveRemindersBase(base);
    return `${remindersBase}${path}`;
  }

  private resolveRemindersBase(baseUrl: string) {
    if (!baseUrl) {
      return '/reminders';
    }

    if (baseUrl.includes('execute-api')) {
      return baseUrl.replace(/\/$/, '');
    }

    if (baseUrl.endsWith('/reminders')) {
      return baseUrl;
    }

    return `${baseUrl}/reminders`;
  }
}
