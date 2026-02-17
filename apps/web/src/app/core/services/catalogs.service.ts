import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';
import { I18nService } from '../i18n/i18n.service';

export interface SpeciesItem {
  code: string;
  label: string;
  eventTypes?: string[];
  isActive?: boolean;
}

export interface BreedItem {
  code: string;
  speciesId?: string;
  label: string;
  weightKg?: {
    male?: { min?: number; max?: number };
    female?: { min?: number; max?: number };
  };
  deprecated?: boolean;
}

interface SpeciesListResponse {
  species: SpeciesItem[];
}

interface BreedsListResponse {
  breeds: BreedItem[];
}

@Injectable({ providedIn: 'root' })
export class CatalogsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly i18n = inject(I18nService);

  getSpecies(): Observable<SpeciesListResponse> {
    const params = new HttpParams().set('locale', this.i18n.locale);
    return this.http.get<SpeciesListResponse>(this.buildUrl('/species'), {
      params,
    });
  }

  getBreeds(speciesId?: string): Observable<BreedsListResponse> {
    let params = new HttpParams().set('locale', this.i18n.locale);
    if (speciesId) {
      params = params.set('species', speciesId);
    }

    return this.http.get<BreedsListResponse>(this.buildUrl('/breeds'), {
      params,
    });
  }

  private buildUrl(path: string) {
    const base = this.baseUrl || '';
    const catalogsBase = this.resolveCatalogsBase(base);
    return `${catalogsBase}${path}`;
  }

  private resolveCatalogsBase(baseUrl: string) {
    if (!baseUrl) {
      return '/catalogs';
    }

    if (baseUrl.includes('execute-api')) {
      return baseUrl.replace(/\/$/, '');
    }

    if (baseUrl.endsWith('/catalogs')) {
      return baseUrl;
    }

    return `${baseUrl}/catalogs`;
  }

}
