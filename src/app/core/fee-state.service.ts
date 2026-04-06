import { Injectable, OnDestroy } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BehaviorSubject, Observable, Subscription, combineLatest, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';
import { Fee } from './firestore/fee.service';

export interface FeeStatsSnapshot {
  totalPending: number;
  totalOverdue: number;
  totalPaid: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
}

@Injectable({ providedIn: 'root' })
export class FeeStateService implements OnDestroy {
  private readonly libraryId$ = new BehaviorSubject<string>('');
  private authSub: Subscription;

  readonly fees$: Observable<Fee[]>;
  readonly feeStats$: Observable<FeeStatsSnapshot>;
  readonly pendingAmountByStudentKey$: Observable<Record<string, number>>;
  readonly paidAmountByStudentKey$: Observable<Record<string, number>>;

  constructor(
    private authService: AuthService,
    private firestore: AngularFirestore
  ) {
    this.authSub = this.authService.userProfile.subscribe((profile) => {
      this.libraryId$.next(profile?.libraryId || '');
    });

    // Date boundary: only pull paid/waived fees from the last 13 months.
    // This covers full-year revenue stats while excluding old historical records.
    const thirteenMonthsAgo = new Date();
    thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13);

    // Query 1: All active (pending/overdue) fees — naturally bounded by active members.
    // Uses single-field index on 'status'; no composite index required.
    const activeFees$: Observable<Fee[]> = this.libraryId$.pipe(
      switchMap((libraryId) => {
        if (!libraryId) return of([] as Fee[]);
        return (this.firestore
          .collection<Fee>(`libraries/${libraryId}/fees`, (ref) =>
            ref.where('status', 'in', ['pending', 'overdue']).limit(500)
          )
          .valueChanges({ idField: 'id' }) as unknown) as Observable<Fee[]>;
      }),
      map((fees) => (fees || []).map((fee) => ({ ...fee, status: this.resolveStatus(fee) }))),
      shareReplay(1)
    );

    // Query 2: Recent paid/waived fees for revenue stats.
    // where + orderBy on the same field (dueDate) uses single-field index — no composite needed.
    // Client-side filter keeps only paid/waived to avoid duplicating active fees.
    const recentPaidFees$: Observable<Fee[]> = this.libraryId$.pipe(
      switchMap((libraryId) => {
        if (!libraryId) return of([] as Fee[]);
        return (this.firestore
          .collection<Fee>(`libraries/${libraryId}/fees`, (ref) =>
            ref.where('dueDate', '>=', thirteenMonthsAgo)
              .orderBy('dueDate', 'desc')
              .limit(2000)
          )
          .valueChanges({ idField: 'id' }) as unknown) as Observable<Fee[]>;
      }),
      map((fees) => (fees || []).filter((fee) => fee.status === 'paid' || fee.status === 'waived')),
      shareReplay(1)
    );

    this.fees$ = combineLatest([activeFees$, recentPaidFees$]).pipe(
      map(([active, paid]) => [...active, ...paid]),
      shareReplay(1)
    );

    this.feeStats$ = this.fees$.pipe(
      map((fees) => this.buildStats(fees)),
      shareReplay(1)
    );

    this.pendingAmountByStudentKey$ = this.fees$.pipe(
      map((fees) => this.buildPendingAmountMap(fees)),
      shareReplay(1)
    );

    this.paidAmountByStudentKey$ = this.fees$.pipe(
      map((fees) => this.buildPaidAmountMap(fees)),
      shareReplay(1)
    );
  }

  ngOnDestroy() {
    this.authSub.unsubscribe();
  }

  private normalizeKey(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private resolveStatus(fee: Fee): Fee['status'] {
    if (fee.status === 'paid' || fee.status === 'waived') {
      return fee.status;
    }

    const dueDate = fee.dueDate instanceof Date ? fee.dueDate : new Date(fee.dueDate as any);
    return new Date() > dueDate ? 'overdue' : 'pending';
  }

  private buildStats(fees: Fee[]): FeeStatsSnapshot {
    const currentMonth = this.getCurrentMonth();
    const currentYear = String(new Date().getFullYear());

    return {
      totalPending: fees
        .filter((fee) => fee.status === 'pending')
        .reduce((sum, fee) => sum + (fee.amount || 0), 0),
      totalOverdue: fees
        .filter((fee) => fee.status === 'overdue')
        .reduce((sum, fee) => sum + (fee.amount || 0), 0),
      totalPaid: fees
        .filter((fee) => fee.status === 'paid')
        .reduce((sum, fee) => sum + (fee.amount || 0), 0),
      monthlyRevenue: fees
        .filter((fee) => fee.status === 'paid' && fee.month === currentMonth)
        .reduce((sum, fee) => sum + (fee.amount || 0), 0),
      yearlyRevenue: fees
        .filter((fee) => fee.status === 'paid' && (fee.month || '').startsWith(currentYear))
        .reduce((sum, fee) => sum + (fee.amount || 0), 0)
    };
  }

  private buildPendingAmountMap(fees: Fee[]): Record<string, number> {
    const pendingMap: Record<string, number> = {};

    fees.forEach((fee) => {
      if (fee.status !== 'pending' && fee.status !== 'overdue') {
        return;
      }

      const amount = Number(fee.amount || 0);
      // Use ONE canonical key to avoid double-counting during lookup.
      const key = this.normalizeKey(fee.studentId) || this.normalizeKey((fee as any).studentDocId);
      if (key) {
        pendingMap[key] = (pendingMap[key] || 0) + amount;
      }
    });

    return pendingMap;
  }

  private buildPaidAmountMap(fees: Fee[]): Record<string, number> {
    const paidMap: Record<string, number> = {};

    fees.forEach((fee) => {
      if (fee.status !== 'paid' && fee.status !== 'waived') return;

      const amount = Number(fee.amount || 0);
      // Use ONE canonical key to avoid double-counting during lookup.
      const key = this.normalizeKey(fee.studentId) || this.normalizeKey((fee as any).studentDocId);
      if (key) {
        paidMap[key] = (paidMap[key] || 0) + amount;
      }
    });

    return paidMap;
  }

  private getCurrentMonth(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }
}