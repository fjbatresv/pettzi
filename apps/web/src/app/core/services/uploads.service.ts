import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';

interface PhotoUploadResponse {
  uploadUrl: string;
  fileKey: string;
  expiresAt: string;
  contentType: string;
}

interface DownloadUrlResponse {
  downloadUrl: string;
  expiresAt: string;
}

@Injectable({ providedIn: 'root' })
export class UploadsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  generatePhotoUploadUrl(petId: string, contentType: string): Observable<PhotoUploadResponse> {
    return this.http.post<PhotoUploadResponse>(this.buildUrl(`/pets/${petId}/photo`), {
      contentType,
    });
  }

  generateDownloadUrl(petId: string, fileKey: string): Observable<DownloadUrlResponse> {
    const encodedKey = encodeURIComponent(fileKey);
    return this.http.get<DownloadUrlResponse>(
      this.buildUrl(`/pets/${petId}/download-url?fileKey=${encodedKey}`)
    );
  }

  deleteFile(petId: string, fileKey: string): Observable<void> {
    const encodedKey = encodeURIComponent(fileKey);
    return this.http.delete<void>(
      this.buildUrl(`/pets/${petId}?fileKey=${encodedKey}`)
    );
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

    if (baseUrl.includes('execute-api')) {
      return baseUrl.replace(/\/$/, '');
    }

    if (baseUrl.endsWith('/uploads')) {
      return baseUrl;
    }

    return `${baseUrl}/uploads`;
  }
}
