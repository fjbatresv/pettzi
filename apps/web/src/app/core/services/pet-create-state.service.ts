import { Injectable } from '@angular/core';

export interface PetCreateDraft {
  name: string;
  speciesCode: string;
  breedCode: string;
  imageDataUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class PetCreateStateService {
  private draft: PetCreateDraft | null = null;

  setDraft(draft: PetCreateDraft) {
    this.draft = { ...draft };
  }

  getDraft() {
    return this.draft;
  }

  clear() {
    this.draft = null;
  }
}
