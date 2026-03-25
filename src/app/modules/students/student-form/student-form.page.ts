import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentService } from '../../../core/firestore/student.service';
import { AuthService } from '../../../core/auth/auth.service';
import { LibraryStateService } from '../../../core/library-state.service';
import { ToastController } from '@ionic/angular';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FirestoreService } from '../../../core/firestore/firestore.service';
import { compressImageToJpeg } from '../../../core/utils/image-compress';

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
  shifts: Array<{ id: string; name: string; monthlyFee: number }> = [];
  selectedShiftIds: string[] = [];
  calculatedMonthlyFee = 0;

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
    private firestoreService: FirestoreService
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
      const lib: any = await this.firestoreService.getCurrentLibraryData();
      this.shifts = Array.isArray(lib?.shifts) ? lib.shifts : [];
    } catch {
      this.shifts = [];
    }

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
      this.selectedShiftIds = Array.isArray((student as any).shiftIds) ? (student as any).shiftIds : [];
      this.recalculateMonthlyFee();
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
      (this.shifts.length === 0 || this.selectedShiftIds.length > 0) &&
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
    this.recalculateMonthlyFee();

    this.errorMessage = '';
    this.isSaving = true;
    try {
      if (this.isEditMode && this.studentId) {
        await this.studentService.updateStudent(this.studentId, {
          name: this.formData.name,
          fatherName: this.formData.fatherName,
          email: this.formData.email,
          phone: this.formData.phone,
          seatNumber,
          adharNumber: adharNormalized,
          shiftIds: this.selectedShiftIds,
          monthlyFee: this.calculatedMonthlyFee,
          addressLine1: String(this.formData.addressLine1 || '').trim(),
          addressLine2: String(this.formData.addressLine2 || '').trim(),
          city: String(this.formData.city || '').trim(),
          state: String(this.formData.state || '').trim(),
          pincode: String(this.formData.pincode || '').trim()
        });

        // Upload photo if selected.
        if (this.selectedPhotoFile) {
          const url = await this.uploadStudentPhoto(this.studentId, this.selectedPhotoFile);
          await this.studentService.updateStudent(this.studentId, { photoUrl: url });
        }
      } else {
        const match = await this.studentService.findByAdharNumber(adharNormalized);
        if (match && match.isActive === false) {
          await this.studentService.reactivateStudent(match.studentId, {
            name: this.formData.name,
            fatherName: this.formData.fatherName,
            email: this.formData.email,
            phone: this.formData.phone,
            seatNumber,
            adharNumber: adharNormalized,
            shiftIds: this.selectedShiftIds,
            monthlyFee: this.calculatedMonthlyFee,
            addressLine1: String(this.formData.addressLine1 || '').trim(),
            addressLine2: String(this.formData.addressLine2 || '').trim(),
            city: String(this.formData.city || '').trim(),
            state: String(this.formData.state || '').trim(),
            pincode: String(this.formData.pincode || '').trim()
          } as any);

          if (this.selectedPhotoFile) {
            const url = await this.uploadStudentPhoto(match.studentId, this.selectedPhotoFile);
            await this.studentService.updateStudent(match.studentId, { photoUrl: url } as any);
          }
          await this.toast('Student reactivated successfully.', 'success');
          this.router.navigate(['/students']);
          return;
        }

        const newStudentId = await this.studentService.addStudent({
          name: this.formData.name,
            fatherName: this.formData.fatherName,
          email: this.formData.email,
          phone: this.formData.phone,
          seatNumber,
          enrollmentDate: new Date(),
          totalFeePending: 0,
          seatStatus: 'occupied',
          adharNumber: adharNormalized,
          shiftIds: this.selectedShiftIds,
          monthlyFee: this.calculatedMonthlyFee,
          addressLine1: String(this.formData.addressLine1 || '').trim(),
          addressLine2: String(this.formData.addressLine2 || '').trim(),
          city: String(this.formData.city || '').trim(),
            state: String(this.formData.state || '').trim(),
          pincode: String(this.formData.pincode || '').trim(),
          isActive: true
        } as any);

        if (this.selectedPhotoFile) {
          const url = await this.uploadStudentPhoto(newStudentId, this.selectedPhotoFile);
          await this.studentService.updateStudent(newStudentId, { photoUrl: url });
        }
      }
      console.log('Student saved, navigating back');
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

  private async uploadStudentPhoto(studentId: string, file: File): Promise<string> {
    const profile = this.authService.currentUserProfileValue;
    const libraryId = this.libraryStateService.currentLibraryId;
    if (!profile?.uid) throw new Error('User not authenticated.');
    if (!libraryId) throw new Error('Library context missing.');

    // Storage path includes uid so simple Storage rules can protect it.
    const path = `userUploads/${profile.uid}/libraries/${libraryId}/students/${studentId}/photo.jpg`;
    const storage = getStorage();

    const ref = storageRef(storage, path);
    const blob = await compressImageToJpeg(file, { maxSizePx: 720, quality: 0.7 });
    await uploadBytes(ref, blob);
    return await getDownloadURL(ref);
  }

  onShiftToggle(shiftId: string, checked: boolean) {
    if (checked) {
      if (!this.selectedShiftIds.includes(shiftId)) {
        this.selectedShiftIds = [...this.selectedShiftIds, shiftId];
      }
    } else {
      this.selectedShiftIds = this.selectedShiftIds.filter((id) => id !== shiftId);
    }
    this.recalculateMonthlyFee();
  }

  private recalculateMonthlyFee() {
    const byId = new Map(this.shifts.map((s) => [s.id, s]));
    this.calculatedMonthlyFee = this.selectedShiftIds.reduce((sum, id) => {
      const s = byId.get(id);
      return sum + Number(s?.monthlyFee || 0);
    }, 0);
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
