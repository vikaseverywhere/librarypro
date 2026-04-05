import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { StudentService, Student } from '../../core/firestore/student.service';
import { FeeService } from '../../core/firestore/fee.service';
import { FeeStateService } from '../../core/fee-state.service';
import { AuthService, UserProfile } from '../../core/auth/auth.service';
import { LibraryStateService } from '../../core/library-state.service';
import { SeatInfo } from '../../shared/components/seat-map.component';

@Component({
  selector: 'app-students',
  templateUrl: './students.page.html',
  styleUrls: ['./students.page.scss']
})
export class StudentsPage implements OnInit, OnDestroy {
  students: Student[] = [];
  inactiveStudents: Student[] = [];
  pendingFeeStudents: Student[] = [];
  filteredStudents: Student[] = [];
  pagedStudents: Student[] = [];
  isLoading = false;
  searchTerm = '';
  viewMode: 'active' | 'inactive' | 'pending' = 'active';
  private rawStudents: Student[] = [];
  private pendingAmounts: Record<string, number> = {};
  private paidAmounts: Record<string, number> = {};
  private pendingAmountsSub?: Subscription;
  private paidAmountsSub?: Subscription;
  private profileSub?: Subscription;

  // Pagination
  currentPage = 1;
  pageSize = 25;
  totalPages = 1;

  libraryName = '';
  userEmail = '';

  // Seat map reactivation modal
  showSeatMapModal = false;
  reactivatingStudent: Student | null = null;
  seatMapTotalSeats = 0;
  seatMapOccupiedSeats: SeatInfo[] = [];
  selectedReactivationSeat: number | null = null;
  isReactivating = false;
  private seatsSub?: Subscription;

  constructor(
    private router: Router,
    private studentService: StudentService,
    private feeService: FeeService,
    private alertController: AlertController,
    private toastController: ToastController,
    private feeStateService: FeeStateService,
    private authService: AuthService,
    private libraryStateService: LibraryStateService
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

    this.profileSub = this.authService.userProfile.subscribe((profile: UserProfile | null) => {
      if (!profile) return;
      this.libraryName = profile.libraryName || '';
      this.userEmail = profile.email || '';
    });

    this.seatsSub = this.libraryStateService.totalSeats$.subscribe(seats => {
      this.seatMapTotalSeats = seats;
    });
  }

  ngOnDestroy() {
    this.pendingAmountsSub?.unsubscribe();
    this.paidAmountsSub?.unsubscribe();
    this.seatsSub?.unsubscribe();
    this.profileSub?.unsubscribe();
  }

  async ionViewWillEnter() {
    await this.loadStudents();
  }

  async loadStudents() {
    this.isLoading = true;
    try {
      this.rawStudents = await this.studentService.getAllStudents();
      this.inactiveStudents = await this.studentService.getInactiveStudents();
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
    const key = this.normalizeKey(student.studentId) || this.normalizeKey(student.id);
    return key ? (this.pendingAmounts[key] || 0) : 0;
  }

  private getPaidAmount(student: Student): number {
    const key = this.normalizeKey(student.studentId) || this.normalizeKey(student.id);
    return key ? (this.paidAmounts[key] || 0) : 0;
  }

  private applyFeeAmounts() {
    this.students = this.rawStudents.map((student) => ({
      ...student,
      totalFeePending: this.getPendingAmount(student),
      totalFeePaid: this.getPaidAmount(student)
    }));
    this.pendingFeeStudents = this.students
      .filter(s => (s.totalFeePending || 0) > 0)
      .sort((a, b) => (b.totalFeePending || 0) - (a.totalFeePending || 0));
    this.onSearchChange();
  }

  onSearchChange() {
    const source = this.viewMode === 'active' ? this.students : this.viewMode === 'inactive' ? this.inactiveStudents : this.pendingFeeStudents;
    if (this.searchTerm.trim()) {
      this.filteredStudents = source.filter(student =>
        student.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        student.phone.includes(this.searchTerm) ||
        student.studentId.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        String(student.seatNumber || '').includes(this.searchTerm)
      );
    } else {
      this.filteredStudents = [...source];
    }
    this.currentPage = 1;
    this.updatePage();
  }

  updatePage() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredStudents.length / this.pageSize));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    const start = (this.currentPage - 1) * this.pageSize;
    this.pagedStudents = this.filteredStudents.slice(start, start + this.pageSize);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePage();
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = start + maxVisible - 1;
    if (end > this.totalPages) {
      end = this.totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  get showingFrom(): number {
    return this.filteredStudents.length === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
  }

  get showingTo(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredStudents.length);
  }

  onViewModeChange(mode: unknown) {
    const m = String(mode);
    this.viewMode = m === 'inactive' ? 'inactive' : m === 'pending' ? 'pending' : 'active';
    this.onSearchChange();
  }

  onCollectFee(student: Student) {
    this.router.navigate(['/tabs/fees/collect'], { queryParams: { studentId: student.studentId } });
  }

  onAddStudent() {
    this.router.navigate(['/tabs/students/add']);
  }

  onEditStudent(student: Student) {
    this.router.navigate(['/tabs/students/edit', student.studentId]);
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

  async onReactivateStudent(student: Student) {
    this.reactivatingStudent = student;
    this.selectedReactivationSeat = null;
    this.isReactivating = false;

    // Build occupied seats for the seat map
    const activeStudents = await this.studentService.getAllStudents(1000);
    this.seatMapOccupiedSeats = activeStudents
      .filter(s => s.seatNumber && s.seatNumber > 0)
      .map(s => ({
        number: s.seatNumber!,
        status: 'occupied' as const,
        studentName: s.name,
        studentId: s.studentId || s.id
      }));

    this.showSeatMapModal = true;
  }

  onSeatSelectedForReactivation(seatNumber: number) {
    this.selectedReactivationSeat = seatNumber;
  }

  closeSeatMapModal() {
    this.showSeatMapModal = false;
    this.reactivatingStudent = null;
    this.selectedReactivationSeat = null;
  }

  async confirmReactivation() {
    if (!this.reactivatingStudent || !this.selectedReactivationSeat) return;
    this.isReactivating = true;

    const student = this.reactivatingStudent;
    try {
      await this.studentService.reactivateStudent(student.studentId, {
        name: student.name,
        fatherName: (student as any).fatherName || '',
        email: student.email,
        phone: student.phone,
        adharNumber: student.adharNumber,
        seatNumber: this.selectedReactivationSeat,
        seatStatus: 'occupied',
        shiftIds: (student as any).shiftIds || [],
        monthlyFee: (student as any).monthlyFee || 0,
        addressLine1: (student as any).addressLine1 || '',
        addressLine2: (student as any).addressLine2 || '',
        state: (student as any).state || '',
        city: (student as any).city || '',
        pincode: (student as any).pincode || ''
      } as any);

      this.closeSeatMapModal();
      await this.loadStudents();
      const t = await this.toastController.create({
        message: `${student.name} reactivated with seat ${this.selectedReactivationSeat || ''}.`,
        duration: 2500,
        color: 'success',
        position: 'bottom'
      });
      await t.present();
    } catch (e: any) {
      const msg = e?.message || 'Failed to reactivate student.';
      const t = await this.toastController.create({
        message: msg,
        duration: 2600,
        color: 'danger',
        position: 'bottom'
      });
      await t.present();
    } finally {
      this.isReactivating = false;
    }
  }

  onOpenStudentProfile(student: Student) {
    this.router.navigate(['/tabs/students/profile', student.studentId]);
  }

  async onPermanentDeleteStudent(student: Student) {
    const alert = await this.alertController.create({
      header: 'Permanently Delete',
      message: `This will permanently delete ${student.name} and all their fee records. This action cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete Forever',
          role: 'destructive',
          handler: async () => {
            if (!student.studentId) return;
            try {
              // Delete all fee records for this student
              const fees = await this.feeService.getFeesByStudent(student.studentId);
              for (const fee of fees) {
                if (fee.id) await this.feeService.deleteFee(fee.id);
              }
              // Permanently delete the student document
              await this.studentService.permanentDeleteStudent(student.studentId);
              await this.loadStudents();
              const t = await this.toastController.create({
                message: `${student.name} permanently deleted.`,
                duration: 2500,
                color: 'success',
                position: 'bottom'
              });
              await t.present();
            } catch (e: any) {
              const t = await this.toastController.create({
                message: e?.message || 'Failed to delete student.',
                duration: 2600,
                color: 'danger',
                position: 'bottom'
              });
              await t.present();
            }
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
    this.router.navigate(['/tabs/dashboard']);
  }
}
