import { Injectable, OnDestroy } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BehaviorSubject, Observable, Subscription, of } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { AuthService } from './auth/auth.service';
import { Fee } from './firestore/fee.service';

export interface FeeStatsSnapshot {
  totalPending: number;
  totalOverdue: number;
  totalPaid: number;
  monthlyRevenue: number;
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

    this.fees$ = this.libraryId$.pipe(
      switchMap((libraryId) => {
        if (!libraryId) {
          return of([] as Fee[]);
        }

        return (this.firestore
          .collection<Fee>(`libraries/${libraryId}/fees`, (ref) =>
            // Spark optimization: keep listener bounded.
            // Sorted by dueDate so most relevant fees are included.
            ref.orderBy('dueDate', 'desc').limit(2000)
          )
          .valueChanges({ idField: 'id' }) as unknown) as Observable<Fee[]>;
      }),
      map((fees) => (fees || []).map((fee) => ({ ...fee, status: this.resolveStatus(fee) }))),
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
      const keys = [
        this.normalizeKey(fee.studentId),
        this.normalizeKey((fee as any).studentDocId)
      ].filter(Boolean);

      keys.forEach((key) => {
        pendingMap[key] = (pendingMap[key] || 0) + amount;
      });
    });

    return pendingMap;
  }

  private buildPaidAmountMap(fees: Fee[]): Record<string, number> {
    const paidMap: Record<string, number> = {};

    fees.forEach((fee) => {
      if (fee.status !== 'paid' && fee.status !== 'waived') return;

      const amount = Number(fee.amount || 0);
      const keys = [
        this.normalizeKey(fee.studentId),
        this.normalizeKey((fee as any).studentDocId)
      ].filter(Boolean);

      keys.forEach((key) => {
        paidMap[key] = (paidMap[key] || 0) + amount;
      });
    });

    return paidMap;
  }

  private getCurrentMonth(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }
}