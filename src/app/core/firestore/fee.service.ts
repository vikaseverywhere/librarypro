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
    const feeId = `fee_${Date.now()}`;
    const feeData: Fee = {
      ...fee,
      feeId,
      status: this.calculateFeeStatus(fee.dueDate, 'pending')
    };
    return this.firestoreService.create('fees', feeData, feeId);
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
    const updateData: Partial<Fee> = {
      status: 'paid',
      paidDate: new Date(),
      paymentMethod,
      paidByUid: profile?.uid,
      paidByEmail: profile?.email,
      receiptNumber
    };

    // Firestore rejects explicit undefined values in update payloads.
    if (paymentId) {
      updateData.paymentId = paymentId;
    }

    await this.firestoreService.update('fees', feeId, updateData);

    // Ledger transaction
    const transactionId = `txn_${Date.now()}`;
    await this.firestoreService.create<Transaction>('transactions', {
      transactionId,
      type: 'fee_paid',
      feeId: feeId,
      studentId: fee.studentId,
      studentName: fee.studentName,
      amount: Number(fee.amount || 0),
      month: String(fee.month || ''),
      receiptNumber,
      paymentMethod: 'cash',
      actorUid: profile?.uid,
      actorEmail: profile?.email,
      note: 'Manual cash payment'
    } as Transaction, transactionId);
  }

  async waiveFee(feeId: string, reason: string): Promise<void> {
    const profile = this.authService.currentUserProfileValue;
    const fee = await this.getFee(feeId);
    if (!fee) {
      throw new Error('Fee record not found.');
    }

    const receiptNumber = fee.receiptNumber || generateReceiptNumber(new Date());
    await this.firestoreService.update('fees', feeId, {
      status: 'waived',
      paymentMethod: 'waived',
      receiptNumber,
      waivedDate: new Date(),
      waivedByUid: profile?.uid,
      waivedByEmail: profile?.email,
      waiveReason: String(reason || '').trim()
    } as Partial<Fee>);

    const transactionId = `txn_${Date.now()}`;
    await this.firestoreService.create<Transaction>('transactions', {
      transactionId,
      type: 'fee_waived',
      feeId: feeId,
      studentId: fee.studentId,
      studentName: fee.studentName,
      amount: Number(fee.amount || 0),
      month: String(fee.month || ''),
      receiptNumber,
      paymentMethod: 'waived',
      actorUid: profile?.uid,
      actorEmail: profile?.email,
      note: String(reason || '').trim() || 'Waived'
    } as Transaction, transactionId);
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
    const fees = await this.firestoreService.list<Fee>('fees');
    const feeArray = (fees || [])
      .sort((a, b) => {
        const aTime = a.dueDate ? new Date(a.dueDate as any).getTime() : 0;
        const bTime = b.dueDate ? new Date(b.dueDate as any).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, pageSize);
    this.updateFeeStatuses(feeArray);
    this.fees$.next(feeArray);
    return feeArray;
  }

  async getFeesByStudent(studentId: string): Promise<Fee[]> {
    const allFees = await this.getAllFees(10000);
    return allFees
      .filter(fee => fee.studentId === studentId)
      .sort((a, b) => (b.month || '').localeCompare(a.month || ''));
  }

  async getFeesByStatus(status: 'pending' | 'paid' | 'overdue' | 'waived'): Promise<Fee[]> {
    const allFees = await this.getAllFees(10000);
    return allFees.filter(fee => fee.status === status);
  }

  async getFeesByMonth(month: string): Promise<Fee[]> {
    const allFees = await this.getAllFees(10000);
    return allFees.filter(fee => fee.month === month);
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
