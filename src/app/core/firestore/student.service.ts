import { Injectable } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { LibraryStateService } from '../library-state.service';

export interface Student {
  id?: string;
  studentId: string;
  // Aadhaar: stored as SHA-256 hash (adharHash) + last 4 digits (adharLast4).
  // adharNumber is DEPRECATED – retained empty string for backward compat with legacy docs.
  adharNumber?: string;
  adharHash?: string;   // SHA-256 hex digest of the 12-digit Aadhaar
  adharLast4?: string;  // Last 4 digits, safe to keep for display
  name: string;
  fatherName?: string;
  email: string;
  phone: string;
  // Student is active unless soft-deleted.
  isActive?: boolean;
  inactiveAt?: Date;
  seatNumber?: number;
  enrollmentDate: Date | any;
  seatStatus: 'occupied' | 'vacant';
  // Shift IDs selected by the student (multi-select). [legacy]
  shiftIds?: string[];
  // Plan-based fee: selected plan ID and name.
  planId?: string;
  planName?: string;
  // Cached monthly fee based on plan selection.
  monthlyFee?: number;
  // Address
  addressLine1?: string;
  addressLine2?: string;
  state?: string;
  city?: string;
  pincode?: string;
  totalFeePending: number;
  // For UI: show how much has been collected (paid+waived).
  totalFeePaid?: number;
  lastFeeDate?: Date;
  // Optional profile image URL stored in Firebase Storage.
  photoUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  private students$ = new BehaviorSubject<Student[]>([]);

  constructor(
    private firestoreService: FirestoreService,
    private libraryStateService: LibraryStateService
  ) {}

  /** SHA-256 hash of the raw Aadhaar string using Web Crypto API. */
  private async hashAadhaar(adhar: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(adhar.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async isSeatNumberTaken(seatNumber: number, excludeStudentId?: string): Promise<boolean> {
    // Note: seatNumber uniqueness is enforced only for ACTIVE students.
    // We query a small page and then ignore inactive students client-side.
    const matches = await this.firestoreService.list<Student>('students', [
      { type: 'where', field: 'seatNumber', operator: '==', value: seatNumber },
      { type: 'limit', limit: 10 }
    ]);

    const activeConflicts = matches.filter((s) => s.isActive !== false);
    if (!activeConflicts.length) return false;

    const conflict = excludeStudentId
      ? activeConflicts.find((s) => s.studentId !== excludeStudentId && s.id !== excludeStudentId)
      : activeConflicts[0];

    return !!conflict;
  }

  async isAdharNumberTaken(adharNumber: string, excludeStudentId?: string): Promise<boolean> {
    const normalized = String(adharNumber || '').trim();
    if (!normalized) return false;

    const hash = await this.hashAadhaar(normalized);

    // Check by hash (new hashed records) and plain text (legacy records) simultaneously.
    const [byHash, byPlain] = await Promise.all([
      this.firestoreService.list<Student>('students', [
        { type: 'where', field: 'adharHash', operator: '==', value: hash },
        { type: 'limit', limit: 2 }
      ]),
      this.firestoreService.list<Student>('students', [
        { type: 'where', field: 'adharNumber', operator: '==', value: normalized },
        { type: 'limit', limit: 2 }
      ])
    ]);

    const matches = [...byHash, ...byPlain];
    if (!matches.length) return false;

    const conflict = matches.find(s =>
      s.isActive !== false &&
      s.studentId !== excludeStudentId &&
      s.id !== excludeStudentId
    );
    return !!conflict;
  }

  async findByAdharNumber(adharNumber: string): Promise<Student | null> {
    const normalized = String(adharNumber || '').trim();
    if (!/^\d{12}$/.test(normalized)) return null;

    const hash = await this.hashAadhaar(normalized);

    // Try hashed first, fall back to legacy plaintext.
    const [byHash, byPlain] = await Promise.all([
      this.firestoreService.list<Student>('students', [
        { type: 'where', field: 'adharHash', operator: '==', value: hash },
        { type: 'limit', limit: 1 }
      ]),
      this.firestoreService.list<Student>('students', [
        { type: 'where', field: 'adharNumber', operator: '==', value: normalized },
        { type: 'limit', limit: 1 }
      ])
    ]);
    return byHash[0] || byPlain[0] || null;
  }

  async addStudent(student: Omit<Student, 'id' | 'studentId'>): Promise<string> {
    if (!student.seatNumber || student.seatNumber < 1) {
      throw new Error('Please provide a valid seat number.');
    }

    const adharNormalized = String(student.adharNumber || '').trim();
    if (!adharNormalized) {
      throw new Error('Please provide Aadhaar number.');
    }
    if (!/^\d{12}$/.test(adharNormalized)) {
      throw new Error('Aadhaar number must be exactly 12 digits.');
    }

    const existing = await this.findByAdharNumber(adharNormalized);
    if (existing) {
      // If existing is inactive, ask caller to reactivate instead of creating a duplicate.
      const active = existing.isActive !== false;
      if (!active) {
        throw new Error('Aadhaar exists but student is inactive. Reactivate this student instead.');
      }
      throw new Error('Aadhaar number already exists. Aadhaar must be unique.');
    }

    const totalSeats = this.libraryStateService.currentTotalSeats;
    if (totalSeats > 0) {
      const stats = await this.getStudentStats();
      if (stats.occupiedSeats >= totalSeats) {
        throw new Error('No seats available. Please increase total seats in Settings.');
      }
    }

    const taken = await this.isSeatNumberTaken(student.seatNumber);
    if (taken) {
      throw new Error(`Seat ${student.seatNumber} is already assigned to another student.`);
    }

    const adharHash = await this.hashAadhaar(adharNormalized);
    const adharLast4 = adharNormalized.slice(-4);

    // Use Firestore auto-ID — collision-free even under rapid concurrent adds.
    const studentData: Student = {
      ...student,
      studentId: '',  // back-filled after insert
      seatStatus: 'occupied',
      totalFeePending: 0,
      adharNumber: '',    // never store plaintext
      adharHash,
      adharLast4,
      isActive: true
    };
    const docId = await this.firestoreService.create('students', studentData);
    await this.firestoreService.update('students', docId, { studentId: docId });
    return docId;
  }

  async updateStudent(studentId: string, data: Partial<Student>): Promise<void> {
    if (typeof data.seatNumber === 'number') {
      if (data.seatNumber < 1) {
        throw new Error('Seat number must be at least 1.');
      }

      const taken = await this.isSeatNumberTaken(data.seatNumber, studentId);
      if (taken) {
        throw new Error(`Seat ${data.seatNumber} is already assigned to another student.`);
      }
    }

    if (typeof data.adharNumber === 'string' && data.adharNumber.trim()) {
      const adharNormalized = data.adharNumber.trim();
      if (!/^\d{12}$/.test(adharNormalized)) {
        throw new Error('Aadhaar number must be exactly 12 digits.');
      }

      const adharTaken = await this.isAdharNumberTaken(adharNormalized, studentId);
      if (adharTaken) {
        throw new Error('Aadhaar number already exists. Aadhaar must be unique.');
      }

      const adharHash = await this.hashAadhaar(adharNormalized);
      data = {
        ...data,
        adharHash,
        adharLast4: adharNormalized.slice(-4),
        adharNumber: '',  // clear any legacy plaintext
      };
    } else {
      // Don't update adhar fields if adharNumber was empty (edit mode, no change)
      const { adharNumber, ...rest } = data as any;
      data = rest;
    }

    return this.firestoreService.update('students', studentId, data);
  }

  async deleteStudent(studentId: string): Promise<void> {
    // Soft delete: mark inactive.
    return this.firestoreService.update('students', studentId, {
      isActive: false,
      inactiveAt: new Date(),
      seatStatus: 'vacant',
      // Free the seat: removing seatNumber prevents seat validation conflicts.
      seatNumber: null as any
    } as any);
  }

  async permanentDeleteStudent(studentId: string): Promise<void> {
    return this.firestoreService.delete('students', studentId);
  }

  async reactivateStudent(studentId: string, data: Partial<Student>): Promise<void> {
    if (typeof data.seatNumber === 'number' && data.seatNumber >= 1) {
      const taken = await this.isSeatNumberTaken(data.seatNumber, studentId);
      if (taken) {
        throw new Error(`Seat ${data.seatNumber} is already assigned to another student.`);
      }
    }
    return this.firestoreService.update('students', studentId, {
      ...data,
      isActive: true,
      inactiveAt: null as any,
      seatStatus: 'occupied',
      enrollmentDate: new Date()
    } as any);
  }

  async getStudent(studentId: string): Promise<Student | null> {
    return this.firestoreService.read('students', studentId);
  }

  async getAllStudents(pageSize: number = 50): Promise<Student[]> {
    const students = await this.firestoreService.list<Student>('students');
    const studentArray = (students || [])
      .filter((s) => s.isActive !== false)
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, pageSize);
    this.students$.next(studentArray);
    return studentArray;
  }

  async getInactiveStudents(pageSize: number = 200): Promise<Student[]> {
    const students = await this.firestoreService.list<Student>('students');
    return (students || [])
      .filter((s) => s.isActive === false)
      .sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt as any).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt as any).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, pageSize);
  }

  async searchStudents(searchTerm: string): Promise<Student[]> {
    // Note: Firestore doesn't support full-text search natively
    // This is a client-side filter. For production, use Algolia or Meilisearch
    const allStudents = await this.getAllStudents(1000);
    return allStudents.filter(student =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.phone.includes(searchTerm)
    );
  }

  get students(): Observable<Student[]> {
    return this.students$.asObservable();
  }

  async getStudentCount(): Promise<number> {
    const students = await this.getAllStudents(10000);
    return students.length;
  }

  async getStudentStats() {
    try {
      const students = await this.getAllStudents(10000);
      const occupiedSeats = students.filter(s => s.seatStatus === 'occupied').length;
      const totalFeePending = students.reduce((sum, s) => sum + (s.totalFeePending || 0), 0);

      return {
        total: students.length,
        occupiedSeats,
        vacantSeats: 0,
        totalFeePending
      };
    } catch (error) {
      console.error('Error getting student stats:', error);
      return {
        total: 0,
        occupiedSeats: 0,
        vacantSeats: 0,
        totalFeePending: 0
      };
    }
  }
}
