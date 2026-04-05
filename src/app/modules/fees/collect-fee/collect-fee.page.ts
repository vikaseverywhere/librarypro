import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { StudentService, Student } from '../../../core/firestore/student.service';
import { FeeService } from '../../../core/firestore/fee.service';
import { FeeStateService } from '../../../core/fee-state.service';

@Component({
  selector: 'app-collect-fee',
  templateUrl: './collect-fee.page.html',
  styleUrls: ['./collect-fee.page.scss']
})
export class CollectFeePage implements OnInit {
  // Step 1: Select student, Step 2: Enter fee details
  step = 1;

  // Student selection
  students: Student[] = [];
  filteredStudents: Student[] = [];
  searchTerm = '';
  selectedStudent: Student | null = null;
  isLoadingStudents = false;
  private rawStudents: Student[] = [];
  private pendingAmounts: Record<string, number> = {};
  private pendingAmountsSub?: Subscription;

  // Fee form
  feeAmount = '';
  feeMonth = '';
  feeDueDate = '';
  isSaving = false;
  errorMessage = '';

  private preSelectStudentId: string | null = null;

  constructor(
    private navController: NavController,
    private route: ActivatedRoute,
    private studentService: StudentService,
    private feeService: FeeService,
    private feeStateService: FeeStateService
  ) {}

  ngOnInit() {
    this.pendingAmountsSub = this.feeStateService.pendingAmountByStudentKey$.subscribe((pendingAmounts) => {
      this.pendingAmounts = pendingAmounts;
      this.applyPendingAmounts();
    });
    this.loadStudents();
    this.setDefaults();
  }

  ngOnDestroy() {
    this.pendingAmountsSub?.unsubscribe();
  }

  async ionViewWillEnter() {
    this.preSelectStudentId = this.route.snapshot.queryParamMap.get('studentId');
    this.reset();
    await this.loadStudents();
    this.autoSelectIfNeeded();
  }

  private autoSelectIfNeeded() {
    if (!this.preSelectStudentId) return;
    const match = this.students.find(
      s => s.studentId === this.preSelectStudentId || s.id === this.preSelectStudentId
    );
    if (match) {
      this.selectStudent(match);
    }
    this.preSelectStudentId = null;
  }

  private reset() {
    this.step = 1;
    this.selectedStudent = null;
    this.searchTerm = '';
    this.errorMessage = '';
    this.setDefaults();
  }

  private setDefaults() {
    const now = new Date();
    this.feeMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const due = new Date();
    due.setDate(due.getDate() + 7);
    this.feeDueDate = due.toISOString().slice(0, 10);
    this.feeAmount = '';
  }

  async loadStudents() {
    this.isLoadingStudents = true;
    try {
      this.rawStudents = await this.studentService.getAllStudents();
      this.applyPendingAmounts();
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      this.isLoadingStudents = false;
    }
  }

  private normalizeKey(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private getPendingAmount(student: Student): number {
    const key = this.normalizeKey(student.studentId) || this.normalizeKey(student.id);
    return key ? (this.pendingAmounts[key] || 0) : 0;
  }

  private applyPendingAmounts() {
    this.students = this.rawStudents.map((student) => ({
      ...student,
      totalFeePending: this.getPendingAmount(student)
    }));
    this.onSearchChange();
  }

  onSearchChange() {
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      this.filteredStudents = this.students.filter(s =>
        s.name.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.phone.includes(this.searchTerm) ||
        s.studentId.toLowerCase().includes(term)
      );
    } else {
      this.filteredStudents = [...this.students];
    }
  }

  selectStudent(student: Student) {
    this.selectedStudent = student;
    // Auto-calc fee based on student's plan fee amount when available.
    const monthlyFee = Number((student as any).monthlyFee || 0);
    if (monthlyFee > 0) {
      this.feeAmount = String(monthlyFee);
    }
    this.step = 2;
  }

  goBackToSelect() {
    this.step = 1;
    this.selectedStudent = null;
    this.errorMessage = '';
  }

  isFormValid(): boolean {
    const amount = parseFloat(this.feeAmount);
    return !!(this.selectedStudent && amount > 0 && this.feeMonth.trim() && this.feeDueDate);
  }

  async onSubmit() {
    if (!this.isFormValid() || !this.selectedStudent) return;
    this.isSaving = true;
    this.errorMessage = '';

    try {
      const studentId = this.selectedStudent.studentId;
      const month = this.feeMonth.trim();
      const alreadyExists = await this.feeService.feeExistsForStudentMonth(studentId, month);
      if (alreadyExists) {
        this.errorMessage = `A fee record for ${this.selectedStudent.name} in ${month} already exists.`;
        this.isSaving = false;
        return;
      }

      await this.feeService.createFee({
        studentId: this.selectedStudent.studentId,
        studentDocId: this.selectedStudent.id || this.selectedStudent.studentId,
        studentName: this.selectedStudent.name,
        amount: parseFloat(this.feeAmount),
        month: this.feeMonth.trim(),
        dueDate: new Date(this.feeDueDate),
        status: 'pending'
      });
      this.navController.navigateBack('/tabs/fees');
    } catch (error) {
      console.error('Error creating fee:', error);
      this.errorMessage = 'Failed to save fee. Please check internet and try again.';
    } finally {
      this.isSaving = false;
    }
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  goBack() {
    this.navController.navigateBack('/tabs/fees');
  }
}
