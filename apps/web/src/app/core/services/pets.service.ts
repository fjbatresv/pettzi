import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';
import { Pet } from '@pettzi/domain-model';

interface PetsListResponse {
  pets: Pet[];
}

export type CreatePetRequest = Pick<
  Pet,
  'name' | 'species' | 'breed' | 'birthDate' | 'notes' | 'color' | 'weightKg'
>;

export type UpdatePetRequest = Partial<
  Pick<Pet, 'name' | 'notes' | 'color' | 'weightKg' | 'breed' | 'birthDate' | 'photoKey'>
>;

@Injectable({ providedIn: 'root' })
export class PetsService {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string
  ) {}

  listPets(): Observable<PetsListResponse> {
    return this.http.get<PetsListResponse>(this.buildUrl('/'));
  }

  createPet(payload: CreatePetRequest): Observable<Pet> {
    return this.http.post<Pet>(this.buildUrl('/'), payload);
  }

  updatePet(petId: string, payload: UpdatePetRequest): Observable<Pet> {
    return this.http.patch<Pet>(this.buildUrl(`/${petId}`), payload);
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
}
