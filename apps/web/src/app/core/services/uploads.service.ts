import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';

interface PhotoUploadResponse {
  uploadUrl: string;
  fileKey: string;
  expiresAt: string;
  contentType: string;
}

@Injectable({ providedIn: 'root' })
export class UploadsService {
  constructor(
    private readonly http: HttpClient,
    @Inject(API_BASE_URL) private readonly baseUrl: string
  ) {}

  generatePhotoUploadUrl(petId: string, contentType: string): Observable<PhotoUploadResponse> {
    return this.http.post<PhotoUploadResponse>(this.buildUrl(`/pets/${petId}/photo`), {
      contentType,
    });
  }

  private buildUrl(path: string) {
    const base = this.baseUrl || '';
    const uploadsBase = this.resolveUploadsBase(base);
    return `${uploadsBase}${path}`;
  }

  private resolveUploadsBase(baseUrl: string) {
    if (!baseUrl) {
      return '/uploads';
    }

    if (baseUrl.endsWith('/uploads')) {
      return baseUrl;
    }

    return `${baseUrl}/uploads`;
  }
}
