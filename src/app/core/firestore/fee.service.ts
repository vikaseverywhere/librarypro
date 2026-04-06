import { Injectable } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { generateReceiptNumber } from '../utils/receipt';

export interface Fee {
  id?: string;
  feeId: string;
  studentId: string;
  studentDocId?: string;
  studentName?: string;
  amount: number;
  month: string; // YYYY-MM format
  status: 'pending' | 'paid' | 'overdue' | 'waived';
  dueDate: Date | any;
  paidDate?: Date | any;
  // Who marked this fee as paid (manual cash / admin action).
  paidByUid?: string;
  paidByEmail?: string;
  receiptNumber?: string;
  waivedDate?: Date | any;
  waivedByUid?: string;
  waivedByEmail?: string;
  waiveReason?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  paymentMethod?: 'razorpay' | 'cash' | 'cheque' | 'waived';
  paymentId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Transaction {
  id?: string;
  transactionId: string;
  type: 'fee_paid' | 'fee_waived';
  feeId: string;
  studentId: string;
  studentName?: string;
  amount: number;
  month: string;
  receiptNumber?: string;
  paymentMethod?: 'cash' | 'waived';
  actorUid?: string;
  actorEmail?: string;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class FeeService {
  private fees$ = new BehaviorSubject<Fee[]>([]);

  constructor(
    private firestoreService: FirestoreService,
    private authService: AuthService
  ) {}

  async createFee(fee: Omit<Fee, 'id' | 'feeId'>): Promise<string> {
    // Pre-generate ID so feeId is set in a single write (no second update needed).
    const feeId = this.firestoreService.newId('fees');
    const feeData = {
      ...fee,
      feeId,
      status: this.calculateFeeStatus(fee.dueDate, 'pending')
    };
    await this.firestoreService.create('fees', feeData, feeId);
    return feeId;
  }

  async feeExistsForStudentMonth(studentId: string, month: string): Promise<boolean> {
    const existing = await this.firestoreService.list<Fee>('fees', [
      { type: 'where', field: 'studentId', operator: '==', value: studentId },
      { type: 'where', field: 'month', operator: '==', value: month },
      { type: 'limit', limit: 1 }
    ]);
    return existing.length > 0;
  }

  async createBulkFees(
    studentIds: string[],
    month: string,
    amount: number,
    dueDate: Date
  ): Promise<string[]> {
    const feeIds: string[] = [];
    for (const studentId of studentIds) {
      const feeId = await this.createFee({
        studentId,
        amount,
        month,
        dueDate,
        status: 'pending'
      });
      feeIds.push(feeId);
    }
    return feeIds;
  }

  async markAsPaid(
    feeId: string,
    paymentMethod: 'razorpay' | 'cash' | 'cheque',
    paymentId?: string
  ): Promise<void> {
    const profile = this.authService.currentUserProfileValue;
    const fee = await this.getFee(feeId);
    if (!fee) {
      throw new Error('Fee record not found.');
    }

    const receiptNumber = fee.receiptNumber || generateReceiptNumber(new Date());
    const txnId = this.firestoreService.newId('transactions');

    const feeUpdate: Record<string, any> = {
      status: 'paid',
      paidDate: new Date(),
      paymentMethod,
      paidByUid: profile?.uid,
      paidByEmail: profile?.email,
      receiptNumber
    };
    if (paymentId) feeUpdate['paymentId'] = paymentId;

    const txnData: Record<string, any> = {
      transactionId: txnId,
      type: 'fee_paid',
      feeId,
      studentId: fee.studentId,
      studentName: fee.studentName,
      amount: Number(fee.amount || 0),
      month: String(fee.month || ''),
      receiptNumber,
      paymentMethod: paymentMethod === 'razorpay' ? 'cash' : paymentMethod,
      actorUid: profile?.uid,
      actorEmail: profile?.email,
      note: paymentMethod === 'razorpay' ? 'Razorpay payment' : 'Manual cash payment'
    };

    // Atomic: fee status + ledger entry succeed or fail together.
    await this.firestoreService.batchWrite([
      { type: 'update', collection: 'fees',         docId: feeId,  data: feeUpdate },
      { type: 'set',    collection: 'transactions', docId: txnId,  data: txnData  }
    ]);
  }

  async waiveFee(feeId: string, reason: string): Promise<void> {
    const profile = this.authService.currentUserProfileValue;
    const fee = await this.getFee(feeId);
    if (!fee) {
      throw new Error('Fee record not found.');
    }

    const receiptNumber = fee.receiptNumber || generateReceiptNumber(new Date());
    const txnId = this.firestoreService.newId('transactions');
    const note = String(reason || '').trim() || 'Waived';

    const feeUpdate: Record<string, any> = {
      status: 'waived',
      paymentMethod: 'waived',
      receiptNumber,
      waivedDate: new Date(),
      waivedByUid: profile?.uid,
      waivedByEmail: profile?.email,
      waiveReason: note
    };

    const txnData: Record<string, any> = {
      transactionId: txnId,
      type: 'fee_waived',
      feeId,
      studentId: fee.studentId,
      studentName: fee.studentName,
      amount: Number(fee.amount || 0),
      month: String(fee.month || ''),
      receiptNumber,
      paymentMethod: 'waived',
      actorUid: profile?.uid,
      actorEmail: profile?.email,
      note
    };

    // Atomic: fee status + ledger entry succeed or fail together.
    await this.firestoreService.batchWrite([
      { type: 'update', collection: 'fees',         docId: feeId,  data: feeUpdate },
      { type: 'set',    collection: 'transactions', docId: txnId,  data: txnData  }
    ]);
  }

  async updateFee(feeId: string, data: Partial<Fee>): Promise<void> {
    return this.firestoreService.update('fees', feeId, data);
  }

  async deleteFee(feeId: string): Promise<void> {
    return this.firestoreService.delete('fees', feeId);
  }

  async getFee(feeId: string): Promise<Fee | null> {
    return this.firestoreService.read('fees', feeId);
  }

  async getAllFees(pageSize: number = 100): Promise<Fee[]> {
    const fees = await this.firestoreService.list<Fee>('fees', [
      { type: 'orderBy', field: 'dueDate', direction: 'desc' },
      { type: 'limit', limit: pageSize }
    ]);
    const feeArray = fees || [];
    this.updateFeeStatuses(feeArray);
    this.fees$.next(feeArray);
    return feeArray;
  }

  async getFeesByStudent(studentId: string): Promise<Fee[]> {
    const fees = await this.firestoreService.list<Fee>('fees', [
      { type: 'where', field: 'studentId', operator: '==', value: studentId },
      { type: 'orderBy', field: 'month', direction: 'desc' },
      { type: 'limit', limit: 500 }
    ]);
    const feeArray = fees || [];
    this.updateFeeStatuses(feeArray);
    return feeArray;
  }

  async getFeesByStatus(status: 'pending' | 'paid' | 'overdue' | 'waived'): Promise<Fee[]> {
    // 'overdue' is computed client-side from 'pending'; query both for non-paid/waived
    if (status === 'overdue') {
      const fees = await this.firestoreService.list<Fee>('fees', [
        { type: 'where', field: 'status', operator: 'in', value: ['pending', 'overdue'] },
        { type: 'orderBy', field: 'dueDate', direction: 'asc' },
        { type: 'limit', limit: 2000 }
      ]);
      const feeArray = fees || [];
      this.updateFeeStatuses(feeArray);
      return feeArray.filter(f => f.status === 'overdue');
    }
    if (status === 'pending') {
      const fees = await this.firestoreService.list<Fee>('fees', [
        { type: 'where', field: 'status', operator: 'in', value: ['pending', 'overdue'] },
        { type: 'orderBy', field: 'dueDate', direction: 'asc' },
        { type: 'limit', limit: 2000 }
      ]);
      const feeArray = fees || [];
      this.updateFeeStatuses(feeArray);
      return feeArray.filter(f => f.status === 'pending');
    }
    const fees = await this.firestoreService.list<Fee>('fees', [
      { type: 'where', field: 'status', operator: '==', value: status },
      { type: 'orderBy', field: 'dueDate', direction: 'desc' },
      { type: 'limit', limit: 2000 }
    ]);
    const feeArray = fees || [];
    this.updateFeeStatuses(feeArray);
    return feeArray;
  }

  async getFeesByMonth(month: string): Promise<Fee[]> {
    const fees = await this.firestoreService.list<Fee>('fees', [
      { type: 'where', field: 'month', operator: '==', value: month },
      { type: 'orderBy', field: 'dueDate', direction: 'desc' },
      { type: 'limit', limit: 1000 }
    ]);
    const feeArray = fees || [];
    this.updateFeeStatuses(feeArray);
    return feeArray;
  }

  private updateFeeStatuses(fees: Fee[]): void {
    fees.forEach(fee => {
      if (fee.status !== 'paid' && fee.status !== 'waived') {
        const dueDate = fee.dueDate instanceof Date ? fee.dueDate : new Date(fee.dueDate);
        const today = new Date();
        if (today > dueDate) {
          fee.status = 'overdue';
        }
      }
    });
  }

  private calculateFeeStatus(
    dueDate: Date | any,
    defaultStatus: string
  ): 'pending' | 'overdue' {
    const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
    const today = new Date();
    return today > due ? 'overdue' : 'pending';
  }

  get fees(): Observable<Fee[]> {
    return this.fees$.asObservable();
  }

  async getFeeStats(): Promise<{
    totalPending: number;
    totalOverdue: number;
    totalPaid: number;
    monthlyRevenue: number;
  }> {
    try {
      const fees = await this.getAllFees(10000);
      const currentMonth = this.getCurrentMonth();

      const totalPending = fees
        .filter(f => f.status === 'pending')
        .reduce((sum, f) => sum + f.amount, 0);

      const totalOverdue = fees
        .filter(f => f.status === 'overdue')
        .reduce((sum, f) => sum + f.amount, 0);

      const totalPaid = fees
        .filter(f => f.status === 'paid')
        .reduce((sum, f) => sum + f.amount, 0);

      const monthlyRevenue = fees
        .filter(f => f.status === 'paid' && f.month === currentMonth)
        .reduce((sum, f) => sum + f.amount, 0);

      return {
        totalPending,
        totalOverdue,
        totalPaid,
        monthlyRevenue
      };
    } catch (error) {
      console.error('Error getting fee stats:', error);
      return {
        totalPending: 0,
        totalOverdue: 0,
        totalPaid: 0,
        monthlyRevenue: 0
      };
    }
  }

  private getCurrentMonth(): string {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  }

  private isCurrentMonth(month: string): boolean {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    return month === currentMonth;
  }
}
