import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentService } from '../../../core/firestore/student.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LibraryStateService } from '../../../core/library-state.service';
import { ToastController } from '@ionic/angular';
import { FirestoreService } from '../../../core/firestore/firestore.service';
import { PlanService, Plan } from '../../../core/firestore/plan.service';
import { SeatInfo } from '../../../shared/components/seat-map.component';
import { PhotoUploadService } from '../../../core/photo-upload.service';


@Component({
  selector: 'app-student-form',
  templateUrl: './student-form.page.html',
  styleUrls: ['./student-form.page.scss']
})
export class StudentFormPage implements OnInit, OnDestroy {
  isEditMode = false;
  studentId = '';
  isLoading = false;
  isSaving = false;
  errorMessage = '';
  photoPreviewUrl: string | null = null;
  selectedPhotoFile: File | null = null;
  libraryName = '';
  userEmail = '';
  plans: Plan[] = [];
  selectedPlanId = '';
  selectedPlan: Plan | null = null;
  totalSeats = 0;
  occupiedSeatData: SeatInfo[] = [];
  editingSeatNumber: number | null = null;

  formData = {
    name: '',
    fatherName: '',
    email: '',
    phone: '',
    seatNumber: '',
    // Aadhaar must be unique per library.
    adharNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: ''
  };

  private pincodeResolution: { city: string; state: string } | null = null;
  private isPincodeResolving = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private studentService: StudentService,
    private authService: AuthService,
    private libraryStateService: LibraryStateService,
    private toastController: ToastController,
    private firestoreService: FirestoreService,
    private planService: PlanService,
    private photoUploadService: PhotoUploadService
  ) {
    console.log('StudentFormPage constructor called');
  }

  async ngOnInit() {
    console.log('StudentFormPage ngOnInit called');
    this.authService.userProfile.subscribe((profile) => {
      if (!profile) return;
      this.libraryName = profile.libraryName || '';
      this.userEmail = profile.email || '';
    });

    try {
      this.plans = await this.planService.getActivePlans();
    } catch {
      this.plans = [];
    }

    // Load seat map data
    try {
      const lib: any = await this.firestoreService.getCurrentLibraryData();
      this.totalSeats = Number(lib?.totalSeats || lib?.seatCount || 0);
    } catch {
      this.totalSeats = 0;
    }
    await this.loadOccupiedSeats();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.studentId = id;
      await this.loadStudent();
    }
  }

  async loadStudent() {
    this.isLoading = true;
    try {
      const student = await this.studentService.getStudent(this.studentId);
      if (!student) {
        this.errorMessage = 'Student not found';
        return;
      }

      this.formData = {
        name: student.name || '',
        fatherName: (student as any).fatherName || '',
        email: student.email || '',
        phone: student.phone || '',
        seatNumber: student.seatNumber ? String(student.seatNumber) : '',
        adharNumber: student.adharNumber || '',
        addressLine1: (student as any).addressLine1 || '',
        addressLine2: (student as any).addressLine2 || '',
        city: (student as any).city || '',
        state: (student as any).state || '',
        pincode: (student as any).pincode || ''
      };

      this.photoPreviewUrl = student.photoUrl || null;
      this.selectedPlanId = (student as any).planId || '';
      this.selectedPlan = this.plans.find(p => p.id === this.selectedPlanId) || null;
      // Track current seat so the seat map shows it as editable
      this.editingSeatNumber = student.seatNumber || null;
    } catch (error) {
      console.error('Error loading student:', error);
      this.errorMessage = 'Failed to load student details';
    } finally {
      this.isLoading = false;
    }
  }

  ionViewWillLoad() {
    console.log('StudentFormPage ionViewWillLoad');
  }

  ionViewDidLoad() {
    console.log('StudentFormPage ionViewDidLoad');
  }

  ionViewWillEnter() {
    console.log('StudentFormPage ionViewWillEnter');
  }

  ionViewDidEnter() {
    console.log('StudentFormPage ionViewDidEnter');
  }

  isFormValid(): boolean {
    const seat = Number(this.formData.seatNumber);
    const adhar = String(this.formData.adharNumber || '').trim();
    const phone = String(this.formData.phone || '').trim();
    return !!(
      this.formData.name &&
      this.formData.fatherName &&
      this.formData.email &&
      this.formData.phone &&
      /^\d{10}$/.test(phone) &&
      this.formData.seatNumber &&
      Number.isInteger(seat) &&
      seat >= 1 &&
      /^\d{12}$/.test(adhar) &&
      (this.plans.length === 0 || this.selectedPlanId) &&
      String(this.formData.city || '').trim() &&
      String(this.formData.state || '').trim() &&
      String(this.formData.addressLine2 || '').trim() &&
      /^\d{6}$/.test(String(this.formData.pincode || '').trim())
    );
  }

  private normalizeForCompare(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  private async resolvePincode(): Promise<void> {
    const pin = String(this.formData.pincode || '').trim();
    if (!/^\d{6}$/.test(pin)) {
      this.pincodeResolution = null;
      return;
    }

    if (this.isPincodeResolving) return;
    this.isPincodeResolving = true;

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const data: any[] = await res.json();
      const first = data?.[0];
      if (first?.Status !== 'Success' || !first?.PostOffice?.length) {
        this.pincodeResolution = null;
        return;
      }
      const po = first.PostOffice[0];
      const city = po?.District || '';
      const state = po?.State || '';
      if (!city || !state) {
        this.pincodeResolution = null;
        return;
      }
      this.pincodeResolution = { city, state };
      // Auto-fill city/state from pincode result.
      this.formData.city = String(city);
      this.formData.state = String(state);
    } catch {
      this.pincodeResolution = null;
    } finally {
      this.isPincodeResolving = false;
    }
  }

  async onPincodeBlur() {
    // Auto-fill city/state from pincode.
    await this.resolvePincode();
  }

  async onSave() {
    console.log('onSave called', this.formData);
    // Auto-resolve pincode -> city/state for strict validation.
    await this.resolvePincode();

    if (!this.isFormValid()) {
      await this.toast('Please fill all fields correctly. Phone: 10 digits, Aadhaar: 12 digits, Pincode: 6 digits.', 'danger');
      return;
    }

    if (this.pincodeResolution) {
      const cityOk = this.normalizeForCompare(this.formData.city) === this.normalizeForCompare(this.pincodeResolution.city);
      const stateOk = this.normalizeForCompare(this.formData.state) === this.normalizeForCompare(this.pincodeResolution.state);
      if (!cityOk || !stateOk) {
        await this.toast('Pincode does not match City/State. Please update City/State as per Pincode.', 'danger');
        return;
      }
    }
    
    const seatNumber = Number(this.formData.seatNumber);
    if (!Number.isInteger(seatNumber) || seatNumber < 1) {
      this.errorMessage = 'Please enter a valid seat number.';
      return;
    }

    const adharNormalized = String(this.formData.adharNumber || '').trim();
    const feeAmount = this.selectedPlan ? this.selectedPlan.amount : 0;

    this.errorMessage = '';
    this.isSaving = true;
    try {
      // Compress photo to base64 data URL (stored in Firestore, no Storage needed)
      let photoUrl: string | undefined;
      if (this.selectedPhotoFile) {
        photoUrl = await this.photoUploadService.compressToDataUrl(
          this.selectedPhotoFile,
          { maxSizePx: 720, quality: 0.7 }
        );
      }

      const baseFields: any = {
        name: this.formData.name,
        fatherName: this.formData.fatherName,
        email: this.formData.email,
        phone: this.formData.phone,
        seatNumber,
        adharNumber: adharNormalized,
        planId: this.selectedPlanId,
        planName: this.selectedPlan?.name || '',
        monthlyFee: feeAmount,
        addressLine1: String(this.formData.addressLine1 || '').trim(),
        addressLine2: String(this.formData.addressLine2 || '').trim(),
        city: String(this.formData.city || '').trim(),
        state: String(this.formData.state || '').trim(),
        pincode: String(this.formData.pincode || '').trim()
      };
      if (photoUrl) baseFields.photoUrl = photoUrl;

      if (this.isEditMode && this.studentId) {
        await this.studentService.updateStudent(this.studentId, baseFields);
      } else {
        const match = await this.studentService.findByAdharNumber(adharNormalized);
        if (match && match.isActive === false) {
          await this.studentService.reactivateStudent(match.studentId, baseFields);
        } else {
          await this.studentService.addStudent({
            ...baseFields,
            enrollmentDate: new Date(),
            totalFeePending: 0,
            seatStatus: 'occupied',
            isActive: true
          } as any);
        }
      }

      this.router.navigate(['/students']);
    } catch (error: any) {
      console.error('Error saving student:', error);
      this.errorMessage = error?.message || 'Failed to save student';
    } finally {
      this.isSaving = false;
    }
  }

  goBack() {
    console.log('goBack called');
    this.router.navigate(['/students']);
  }

  ngOnDestroy() {
    if (this.photoPreviewUrl && this.photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.photoPreviewUrl);
    }
  }

  onPhotoSelected(event: any) {
    const file: File | undefined = event?.target?.files?.[0];
    if (!file) return;

    this.selectedPhotoFile = file;
    if (this.photoPreviewUrl && this.photoPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(this.photoPreviewUrl);
    }
    this.photoPreviewUrl = URL.createObjectURL(file);
  }

  onPlanChange(planId: string) {
    this.selectedPlanId = planId;
    this.selectedPlan = this.plans.find(p => p.id === planId) || null;
  }

  private async loadOccupiedSeats() {
    try {
      const allStudents = await this.studentService.getAllStudents(1000);
      this.occupiedSeatData = allStudents
        .filter(s => s.seatNumber && s.seatNumber > 0)
        // In edit mode, exclude the current student's seat so they can keep it
        .filter(s => !(this.isEditMode && (s.studentId === this.studentId || s.id === this.studentId)))
        .map(s => ({
          number: s.seatNumber!,
          status: 'occupied' as const,
          studentName: s.name,
          studentId: s.studentId || s.id
        }));
    } catch {
      this.occupiedSeatData = [];
    }
  }

  onSeatSelected(seatNumber: number) {
    this.formData.seatNumber = String(seatNumber);
  }

  private async toast(message: string, color: 'success' | 'danger') {
    const t = await this.toastController.create({
      message,
      duration: 2400,
      color,
      position: 'bottom'
    });
    await t.present();
  }
}
