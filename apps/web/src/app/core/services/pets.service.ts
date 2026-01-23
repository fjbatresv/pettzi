import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_BASE_URL } from '../tokens';
import { EventType, Pet, PetEvent } from '@pettzi/domain-model';

interface PetsListResponse {
  pets: Pet[];
}

export interface CreateSharedRecordRequest {
  items: EventType[];
  expiresIn: '24h' | '3d' | '1w' | '1m';
  password?: string;
}

export interface CreateSharedRecordResponse {
  token: string;
  petId: string;
  items: EventType[];
  expiresAt: string;
}

export interface SharedRecordResponse {
  token?: string;
  petId?: string;
  items?: EventType[];
  expiresAt?: string;
  createdAt?: string;
  pet?: Pet;
  photoUrl?: string;
  events?: PetEvent[];
  nextCursor?: string;
  requiresPassword?: boolean;
  message?: string;
}

export type CreatePetRequest = Pick<
  Pet,
  | 'name'
  | 'species'
  | 'breed'
  | 'birthDate'
  | 'notes'
  | 'color'
  | 'sex'
  | 'isNeutered'
  | 'bloodType'
  | 'weightKg'
  | 'lastGroomingDate'
  | 'lastVetVisitDate'
  | 'healthIndex'
>;

export type UpdatePetRequest = Partial<
  Pick<
    Pet,
    | 'name'
    | 'notes'
    | 'color'
    | 'weightKg'
    | 'breed'
    | 'species'
    | 'birthDate'
    | 'sex'
    | 'isNeutered'
    | 'bloodType'
    | 'photoKey'
    | 'photoThumbnailKey'
    | 'lastGroomingDate'
    | 'lastVetVisitDate'
    | 'healthIndex'
  >
>;

@Injectable({ providedIn: 'root' })
export class PetsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly petsCacheKey = 'pettzi.petsCache';
  private readonly petsCacheTtlMs = 60_000;

  listPets(): Observable<PetsListResponse> {
    const cached = this.getCachedPets();
    if (cached) {
      return of(cached);
    }
    return this.http.get<PetsListResponse>(this.buildUrl('/')).pipe(
      tap((response) => this.cachePets(response))
    );
  }

  createPet(payload: CreatePetRequest): Observable<Pet> {
    return this.http.post<Pet>(this.buildUrl('/'), payload).pipe(
      tap(() => this.clearPetsCache())
    );
  }

  updatePet(petId: string, payload: UpdatePetRequest): Observable<Pet> {
    return this.http.patch<Pet>(this.buildUrl(`/${petId}`), payload).pipe(
      tap(() => this.clearPetsCache())
    );
  }

  createSharedRecord(
    petId: string,
    payload: CreateSharedRecordRequest
  ): Observable<CreateSharedRecordResponse> {
    return this.http.post<CreateSharedRecordResponse>(
      this.buildUrl(`/${petId}/shared-records`),
      payload
    );
  }

  getSharedRecord(
    token: string,
    options?: { password?: string; limit?: number; cursor?: string }
  ): Observable<SharedRecordResponse> {
    let params = new HttpParams();
    if (options?.password) {
      params = params.set('password', options.password);
    }
    if (options?.limit) {
      params = params.set('limit', String(options.limit));
    }
    if (options?.cursor) {
      params = params.set('cursor', options.cursor);
    }
    return this.http.get<SharedRecordResponse>(
      this.buildUrl(`/shared-records/${encodeURIComponent(token)}`),
      { params }
    );
  }

  deletePet(petId: string): Observable<{ message?: string; pet?: Pet }> {
    return this.http.delete<{ message?: string; pet?: Pet }>(this.buildUrl(`/${petId}`)).pipe(
      tap(() => this.clearPetsCache())
    );
  }

  listPetsFresh(): Observable<PetsListResponse> {
    this.clearPetsCache();
    return this.http.get<PetsListResponse>(this.buildUrl('/'));
  }

  private buildUrl(path: string) {
    const base = this.baseUrl || '';
    const petsBase = this.resolvePetsBase(base);
    return `${petsBase}${path}`;
  }

  private resolvePetsBase(baseUrl: string) {
    if (!baseUrl) {
      return '/pets';
    }

    if (baseUrl.includes('execute-api')) {
      return baseUrl.replace(/\/$/, '');
    }

    if (baseUrl.endsWith('/pets')) {
      return baseUrl;
    }

    return `${baseUrl}/pets`;
  }

  private getCachedPets(): PetsListResponse | null {
    const raw = sessionStorage.getItem(this.petsCacheKey);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as { data: PetsListResponse; expiresAt: number };
      if (!parsed?.data?.pets || !Number.isFinite(parsed.expiresAt)) {
        this.clearPetsCache();
        return null;
      }
      if (parsed.expiresAt <= Date.now()) {
        this.clearPetsCache();
        return null;
      }
      return parsed.data;
    } catch {
      this.clearPetsCache();
      return null;
    }
  }

  private cachePets(response: PetsListResponse) {
    const payload = {
      data: response,
      expiresAt: Date.now() + this.petsCacheTtlMs,
    };
    sessionStorage.setItem(this.petsCacheKey, JSON.stringify(payload));
  }

  private clearPetsCache() {
    sessionStorage.removeItem(this.petsCacheKey);
  }
}
