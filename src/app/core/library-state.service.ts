import { Injectable, OnDestroy } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BehaviorSubject, Observable, Subscription, firstValueFrom } from 'rxjs';
import { distinctUntilChanged, filter, map, shareReplay, switchMap, take } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';

/**
 * Central reactive state for library-level settings (totalSeats, etc.).
 * Uses a real-time Firestore listener so any update — from dashboard, settings,
 * or any other component — is instantly reflected everywhere via totalSeats$.
 */
@Injectable({ providedIn: 'root' })
export class LibraryStateService implements OnDestroy {
  private readonly libraryId$ = new BehaviorSubject<string>('');
  private authSub: Subscription;
  private cacheSub: Subscription;
  private _currentTotalSeats = 0;

  /**
   * Real-time stream of the library's totalSeats.
   * Uses shareReplay(1) so late subscribers (e.g. navigating back to a page)
   * receive the last emitted value immediately without waiting for a new read.
   */
  readonly totalSeats$: Observable<number>;

  constructor(
    private authService: AuthService,
    private firestore: AngularFirestore
  ) {
    // Keep libraryId$ in sync with the authenticated user
    this.authSub = this.authService.userProfile.subscribe(profile => {
      this.libraryId$.next(profile?.libraryId || '');
    });

    // Real-time Firestore listener that follows the active library document
    this.totalSeats$ = this.libraryId$.pipe(
      filter(id => !!id),
      switchMap(id =>
        // Cast needed to bridge AngularFire's bundled rxjs version with the app's rxjs
        (this.firestore.doc<any>(`libraries/${id}`).valueChanges() as unknown) as Observable<any>
      ),
      map((data: any) => Number(data?.totalSeats ?? data?.seatCount ?? 0)),
      distinctUntilChanged(),
      shareReplay(1)
    );

    // Maintain a synchronous snapshot so services can read the value imperatively
    this.cacheSub = this.totalSeats$.subscribe(seats => {
      this._currentTotalSeats = seats;
    });
  }

  ngOnDestroy() {
    this.authSub.unsubscribe();
    this.cacheSub.unsubscribe();
  }

  /** Current libraryId (synchronous). Empty string when not logged in. */
  get currentLibraryId(): string {
    return this.libraryId$.value;
  }

  /** Synchronous snapshot of the last-known totalSeats value. */
  get currentTotalSeats(): number {
    return this._currentTotalSeats;
  }

  private async ensureLibraryId(fallbackLibraryId?: string): Promise<string> {
    if (fallbackLibraryId) {
      return fallbackLibraryId;
    }

    if (this.libraryId$.value) {
      return this.libraryId$.value;
    }

    const id = await firstValueFrom(
      this.libraryId$.pipe(
        filter(value => !!value),
        take(1)
      )
    );

    if (!id) {
      throw new Error('Library not loaded. Please login again.');
    }

    return id;
  }

  /**
   * Persists new totalSeats to Firestore.
   * Uses set+merge so it works even if the field didn't exist on older documents.
   * The change automatically propagates to all totalSeats$ subscribers.
   */
  async updateTotalSeats(seats: number, libraryId?: string): Promise<void> {
    const resolvedLibraryId = await this.ensureLibraryId(libraryId);
    await this.firestore.doc(`libraries/${resolvedLibraryId}`).set(
      { totalSeats: seats, seatCount: seats, updatedAt: new Date() },
      { merge: true }
    );
  }
}
