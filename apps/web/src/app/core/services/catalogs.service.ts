import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../tokens';

export interface SpeciesItem {
  code: string;
  label: string;
}

export interface BreedItem {
  code: string;
  speciesCode: string;
  label: string;
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

  getSpecies(): Observable<SpeciesListResponse> {
    return this.http.get<SpeciesListResponse>(this.buildUrl('/species'));
  }

  getBreeds(speciesId?: string): Observable<BreedsListResponse> {
    let params = new HttpParams();
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
