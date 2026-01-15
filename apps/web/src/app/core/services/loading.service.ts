import { Injectable } from '@angular/core';
import { asyncScheduler, BehaviorSubject } from 'rxjs';
import { distinctUntilChanged, map, observeOn } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private readonly pending = new BehaviorSubject<number>(0);
  readonly isLoading$ = this.pending.pipe(
    map((count) => count > 0),
    distinctUntilChanged(),
    observeOn(asyncScheduler),
  );

  show() {
    this.pending.next(this.pending.value + 1);
  }

  hide() {
    const next = Math.max(0, this.pending.value - 1);
    this.pending.next(next);
  }

  reset() {
    this.pending.next(0);
  }
}
