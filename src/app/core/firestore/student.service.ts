import { Injectable } from '@angular/core';
import { FirestoreService } from './firestore.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { LibraryStateService } from '../library-state.service';

export interface Student {
  id?: string;
  studentId: string;
  name: string;
  email: string;
  phone: string;
  seatNumber?: number;
  enrollmentDate: Date | any;
  seatStatus: 'occupied' | 'vacant';
  totalFeePending: number;
  lastFeeDate?: Date;
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

  async isSeatNumberTaken(seatNumber: number, excludeStudentId?: string): Promise<boolean> {
    const matches = await this.firestoreService.list<Student>('students', [
      { type: 'where', field: 'seatNumber', operator: '==', value: seatNumber },
      { type: 'limit', limit: 1 }
    ]);

    if (!matches.length) {
      return false;
    }

    if (excludeStudentId && matches[0].studentId === excludeStudentId) {
      return false;
    }

    return true;
  }

  async addStudent(student: Omit<Student, 'id' | 'studentId'>): Promise<string> {
    if (!student.seatNumber || student.seatNumber < 1) {
      throw new Error('Please provide a valid seat number.');
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

    const studentId = `std_${Date.now()}`;
    const studentData: Student = {
      ...student,
      studentId,
      seatStatus: 'occupied',
      totalFeePending: 0
    };
    return this.firestoreService.create('students', studentData, studentId);
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

    return this.firestoreService.update('students', studentId, data);
  }

  async deleteStudent(studentId: string): Promise<void> {
    return this.firestoreService.delete('students', studentId);
  }

  async getStudent(studentId: string): Promise<Student | null> {
    return this.firestoreService.read('students', studentId);
  }

  async getAllStudents(pageSize: number = 50): Promise<Student[]> {
    const students = await this.firestoreService.list<Student>('students');
    const studentArray = (students || [])
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt as any).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt as any).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, pageSize);
    this.students$.next(studentArray);
    return studentArray;
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
