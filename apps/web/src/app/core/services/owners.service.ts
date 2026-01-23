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

export interface PetInvitePreview {
  pet: {
    petId: string;
    name: string;
    breed: string;
    species: string;
    age: string;
    imageUrl: string;
  };
  inviter: {
    ownerId: string;
    fullName: string;
    imageUrl: string;
  };
  expiresAt: string;
  status?: 'accepted' | 'already-linked';
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

  previewPetInvite(token: string): Observable<PetInvitePreview> {
    return this.http.get<PetInvitePreview>(
      this.buildUrl(`/pet-invites/preview?token=${encodeURIComponent(token)}`)
    );
  }

  acceptPetInvite(token: string): Observable<PetInvitePreview> {
    return this.http.post<PetInvitePreview>(this.buildUrl('/pet-invites/accept'), { token });
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
