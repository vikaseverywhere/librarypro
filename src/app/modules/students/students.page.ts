import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { StudentService, Student } from '../../core/firestore/student.service';
import { FeeStateService } from '../../core/fee-state.service';
import { AuthService, UserProfile } from '../../core/auth/auth.service';

@Component({
  selector: 'app-students',
  templateUrl: './students.page.html',
  styleUrls: ['./students.page.scss']
})
export class StudentsPage implements OnInit {
  students: Student[] = [];
  filteredStudents: Student[] = [];
  isLoading = false;
  searchTerm = '';
  private rawStudents: Student[] = [];
  private pendingAmounts: Record<string, number> = {};
  private paidAmounts: Record<string, number> = {};
  private pendingAmountsSub?: Subscription;
  private paidAmountsSub?: Subscription;

  libraryName = '';
  userEmail = '';

  constructor(
    private router: Router,
    private studentService: StudentService,
    private alertController: AlertController,
    private feeStateService: FeeStateService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.pendingAmountsSub = this.feeStateService.pendingAmountByStudentKey$.subscribe((pendingAmounts) => {
      this.pendingAmounts = pendingAmounts;
      this.applyFeeAmounts();
    });

    this.paidAmountsSub = this.feeStateService.paidAmountByStudentKey$.subscribe((paidAmounts) => {
      this.paidAmounts = paidAmounts;
      this.applyFeeAmounts();
    });

    this.authService.userProfile.subscribe((profile: UserProfile | null) => {
      if (!profile) return;
      this.libraryName = profile.libraryName || '';
      this.userEmail = profile.email || '';
    });
    this.loadStudents();
  }

  ngOnDestroy() {
    this.pendingAmountsSub?.unsubscribe();
    this.paidAmountsSub?.unsubscribe();
  }

  async ionViewWillEnter() {
    await this.loadStudents();
  }

  async loadStudents() {
    this.isLoading = true;
    try {
      this.rawStudents = await this.studentService.getAllStudents();
      this.applyFeeAmounts();
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private normalizeKey(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private getPendingAmount(student: Student): number {
    const keys = [this.normalizeKey(student.studentId), this.normalizeKey(student.id)].filter(Boolean);
    return keys.reduce((sum, key) => sum + (this.pendingAmounts[key] || 0), 0);
  }

  private getPaidAmount(student: Student): number {
    const keys = [this.normalizeKey(student.studentId), this.normalizeKey(student.id)].filter(Boolean);
    return keys.reduce((sum, key) => sum + (this.paidAmounts[key] || 0), 0);
  }

  private applyFeeAmounts() {
    this.students = this.rawStudents.map((student) => ({
      ...student,
      totalFeePending: this.getPendingAmount(student),
      totalFeePaid: this.getPaidAmount(student)
    }));
    this.onSearchChange();
  }

  onSearchChange() {
    if (this.searchTerm.trim()) {
      this.filteredStudents = this.students.filter(student =>
        student.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        student.phone.includes(this.searchTerm) ||
        student.studentId.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        String(student.seatNumber || '').includes(this.searchTerm)
      );
    } else {
      this.filteredStudents = [...this.students];
    }
  }

  onAddStudent() {
    console.log('onAddStudent - navigating to /students/add');
    this.router.navigate(['/students/add']);
  }

  onEditStudent(student: Student) {
    console.log('onEditStudent - navigating to /students/edit/' + student.studentId);
    this.router.navigate(['/students/edit', student.studentId]);
  }

  async onDeleteStudent(student: Student) {
    const alert = await this.alertController.create({
      header: 'Delete Student',
      message: `Remove ${student.name} from this library?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            if (!student.studentId) return;
            // Soft delete -> inactive
            await this.studentService.deleteStudent(student.studentId);
            await this.loadStudents();
          }
        }
      ]
    });
    await alert.present();
  }

  getInitials(name: string): string {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || '';
    // Use second word as "middle/second name" (as per requirement).
    const second = parts[1]?.[0] || '';
    return (first + second).toUpperCase();
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
