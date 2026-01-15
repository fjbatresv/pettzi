import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_BASE_URL } from '../tokens';

interface PhotoUploadResponse {
  uploadUrl: string;
  fileKey: string;
  expiresAt: string;
  contentType: string;
}

interface ProfilePhotoUploadResponse {
  uploadUrl: string;
  fileKey: string;
  expiresAt: string;
  contentType: string;
}

interface DocumentUploadResponse {
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
    }, {
      headers: new HttpHeaders({ 'x-skip-loading': 'true' }),
    });
  }

  generateProfilePhotoUploadUrl(contentType: string): Observable<ProfilePhotoUploadResponse> {
    return this.http.post<ProfilePhotoUploadResponse>(this.buildUrl('/profile/photo'), {
      contentType,
    }, {
      headers: new HttpHeaders({ 'x-skip-loading': 'true' }),
    });
  }

  generateDocumentUploadUrl(petId: string, contentType: string): Observable<DocumentUploadResponse> {
    return this.http.post<DocumentUploadResponse>(this.buildUrl(`/pets/${petId}/document`), {
      contentType,
    }, {
      headers: new HttpHeaders({ 'x-skip-loading': 'true' }),
    });
  }

  generateDownloadUrl(petId: string, fileKey: string): Observable<DownloadUrlResponse> {
    const cached = this.getCachedDownloadUrl(petId, fileKey);
    if (cached) {
      return of(cached);
    }
    const encodedKey = encodeURIComponent(fileKey);
    return this.http.get<DownloadUrlResponse>(
      this.buildUrl(`/pets/${petId}/download-url?fileKey=${encodedKey}`)
    , {
      headers: new HttpHeaders({ 'x-skip-loading': 'true' }),
    }).pipe(
      tap((response) => this.cacheDownloadUrl(petId, fileKey, response))
    );
  }

  generateProfileDownloadUrl(fileKey: string): Observable<DownloadUrlResponse> {
    const cached = this.getCachedProfileDownloadUrl(fileKey);
    if (cached) {
      return of(cached);
    }
    const encodedKey = encodeURIComponent(fileKey);
    return this.http.get<DownloadUrlResponse>(
      this.buildUrl(`/profile/download-url?fileKey=${encodedKey}`),
      {
        headers: new HttpHeaders({ 'x-skip-loading': 'true' }),
      }
    ).pipe(
      tap((response) => this.cacheProfileDownloadUrl(fileKey, response))
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

  private getDownloadCacheKey(petId: string, fileKey: string) {
    return `pettzi.downloadUrl:${petId}:${encodeURIComponent(fileKey)}`;
  }

  private getProfileDownloadCacheKey(fileKey: string) {
    return `pettzi.profileDownloadUrl:${encodeURIComponent(fileKey)}`;
  }

  private getCachedDownloadUrl(petId: string, fileKey: string): DownloadUrlResponse | null {
    const key = this.getDownloadCacheKey(petId, fileKey);
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as DownloadUrlResponse;
      if (!parsed?.downloadUrl || !parsed?.expiresAt) {
        sessionStorage.removeItem(key);
        return null;
      }
      const expiresAt = new Date(parsed.expiresAt).getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        sessionStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch {
      sessionStorage.removeItem(key);
      return null;
    }
  }

  private getCachedProfileDownloadUrl(fileKey: string): DownloadUrlResponse | null {
    const key = this.getProfileDownloadCacheKey(fileKey);
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as DownloadUrlResponse;
      if (!parsed?.downloadUrl || !parsed?.expiresAt) {
        sessionStorage.removeItem(key);
        return null;
      }
      const expiresAt = new Date(parsed.expiresAt).getTime();
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        sessionStorage.removeItem(key);
        return null;
      }
      return parsed;
    } catch {
      sessionStorage.removeItem(key);
      return null;
    }
  }

  private cacheDownloadUrl(petId: string, fileKey: string, response: DownloadUrlResponse) {
    if (!response?.downloadUrl || !response?.expiresAt) {
      return;
    }
    const key = this.getDownloadCacheKey(petId, fileKey);
    sessionStorage.setItem(key, JSON.stringify(response));
  }

  private cacheProfileDownloadUrl(fileKey: string, response: DownloadUrlResponse) {
    if (!response?.downloadUrl || !response?.expiresAt) {
      return;
    }
    const key = this.getProfileDownloadCacheKey(fileKey);
    sessionStorage.setItem(key, JSON.stringify(response));
  }
}
