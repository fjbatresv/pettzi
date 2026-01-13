import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../tokens';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getHealth() {
    const url = this.baseUrl ? `${this.baseUrl}/health` : '/health';
    return this.http.get<{ status: string }>(url);
  }
}
