import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';

export type OwnerRole = 'PRIMARY' | 'SECONDARY';

export interface OwnerProfileSummary {
  fullName?: string;
  email?: string;
  profilePhotoKey?: string;
  locale?: 'es' | 'en';
}

export interface PetOwner {
  petId: string;
  ownerId: string;
  role: OwnerRole;
  linkedAt?: string;
  profile?: OwnerProfileSummary;
}

interface OwnersListResponse {
  owners: PetOwner[];
}

@Injectable({ providedIn: 'root' })
export class OwnersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listPetOwners(petId: string): Observable<OwnersListResponse> {
    return this.http.get<OwnersListResponse>(this.buildUrl(`/pets/${petId}/owners`));
  }

  invitePetOwner(petId: string, email: string): Observable<{ message?: string }> {
    return this.http.post<{ message?: string }>(
      this.buildUrl(`/pets/${petId}/owners/invite`),
      { email }
    );
  }

  removePetOwner(petId: string, ownerId: string): Observable<{ message?: string }> {
    const encodedOwnerId = encodeURIComponent(ownerId);
    return this.http.delete<{ message?: string }>(
      this.buildUrl(`/pets/${petId}/owners/${encodedOwnerId}`)
    );
  }

  private buildUrl(path: string) {
    const base = this.baseUrl || '';
    const ownersBase = this.resolveOwnersBase(base);
    return `${ownersBase}${path}`;
  }

  private resolveOwnersBase(baseUrl: string) {
    if (!baseUrl) {
      return '/owners';
    }

    if (baseUrl.includes('execute-api')) {
      return baseUrl.replace(/\/$/, '');
    }

    if (baseUrl.endsWith('/owners')) {
      return baseUrl;
    }

    return `${baseUrl}/owners`;
  }
}
