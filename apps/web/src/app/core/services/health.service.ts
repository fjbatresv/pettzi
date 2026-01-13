import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../tokens';

@Injectable({ providedIn: 'root' })
export class HealthService {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string
  ) {}

  getHealth() {
    const url = this.baseUrl ? `${this.baseUrl}/health` : '/health';
    return this.http.get<{ status: string }>(url);
  }
}
