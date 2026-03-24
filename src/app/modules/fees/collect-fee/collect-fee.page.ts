import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';
import { StudentService, Student } from '../../../core/firestore/student.service';
import { FeeService } from '../../../core/firestore/fee.service';

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

  // Fee form
  feeAmount = '';
  feeMonth = '';
  feeDueDate = '';
  isSaving = false;
  errorMessage = '';

  constructor(
    private navController: NavController,
    private studentService: StudentService,
    private feeService: FeeService
  ) {}

  ngOnInit() {
    this.loadStudents();
    this.setDefaults();
  }

  async ionViewWillEnter() {
    this.reset();
    await this.loadStudents();
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
    this.feeAmount = '5000';
  }

  async loadStudents() {
    this.isLoadingStudents = true;
    try {
      this.students = await this.studentService.getAllStudents();
      this.filteredStudents = [...this.students];
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      this.isLoadingStudents = false;
    }
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
      await this.feeService.createFee({
        studentId: this.selectedStudent.studentId,
        amount: parseFloat(this.feeAmount),
        month: this.feeMonth.trim(),
        dueDate: new Date(this.feeDueDate),
        status: 'pending'
      });
      this.navController.navigateBack('/fees');
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
    this.navController.navigateBack('/fees');
  }
}
