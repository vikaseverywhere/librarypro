import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImageToJpeg } from '../../core/utils/image-compress';
import { AngularFirestore } from '@angular/fire/compat/firestore';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss']
})
export class SignupPage implements OnInit {
  signupForm!: FormGroup;
  isLoading = false;
  ownerPhotoFile: File | null = null;
  libraryPhotoFile: File | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private firestore: AngularFirestore
  ) {}

  ngOnInit() {
    this.initializeForm();
  }

  private initializeForm() {
    this.signupForm = this.formBuilder.group({
      libraryName: ['', [Validators.required, Validators.minLength(3)]],
      city: ['', [Validators.required]],
      totalSeats: [50, [Validators.required, Validators.min(1)]],
      shiftCount: [2, [Validators.required, Validators.min(1), Validators.max(4)]],
      shift1Fee: [2500, [Validators.required, Validators.min(0)]],
      shift2Fee: [2500, [Validators.required, Validators.min(0)]],
      shift3Fee: [2500, [Validators.required, Validators.min(0)]],
      shift4Fee: [2500, [Validators.required, Validators.min(0)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ionViewWillEnter() {
    if (!this.signupForm) {
      this.initializeForm();
    } else {
      this.signupForm.reset();
    }
  }

  passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  async onSignup() {
    if (this.signupForm.invalid) {
      this.showError('Please fill all fields correctly');
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Creating your account...'
    });
    await loading.present();

    try {
      const { email, password, libraryName, city, totalSeats, shiftCount, shift1Fee, shift2Fee } = this.signupForm.value;

      const shifts: Array<{ id: string; name: string; monthlyFee: number }> = [];
      const count = Math.max(1, Number(shiftCount) || 1);
      shifts.push({ id: 's1', name: 'Shift 1', monthlyFee: Number(shift1Fee) || 0 });
      if (count >= 2) shifts.push({ id: 's2', name: 'Shift 2', monthlyFee: Number(shift2Fee) || 0 });
      if (count >= 3) shifts.push({ id: 's3', name: 'Shift 3', monthlyFee: Number((this.signupForm.value as any).shift3Fee) || 0 });
      if (count >= 4) shifts.push({ id: 's4', name: 'Shift 4', monthlyFee: Number((this.signupForm.value as any).shift4Fee) || 0 });

      const profile = await this.authService.signup(
        email,
        password,
        libraryName,
        city,
        Number(totalSeats),
        shifts
      );

      // Upload optional photos (compressed) and store URLs.
      const libraryId = profile.libraryId;
      const uid = profile.uid;
      const storage = getStorage();

      if (this.ownerPhotoFile) {
        const blob = await compressImageToJpeg(this.ownerPhotoFile, { maxSizePx: 720, quality: 0.7 });
        const ref = storageRef(storage, `userUploads/${uid}/profile/owner.jpg`);
        await uploadBytes(ref, blob);
        const url = await getDownloadURL(ref);
        await this.firestore.doc(`users/${uid}`).set({ photoUrl: url, updatedAt: new Date() }, { merge: true });
      }

      if (this.libraryPhotoFile) {
        const blob = await compressImageToJpeg(this.libraryPhotoFile, { maxSizePx: 900, quality: 0.72 });
        const ref = storageRef(storage, `userUploads/${uid}/libraries/${libraryId}/library.jpg`);
        await uploadBytes(ref, blob);
        const url = await getDownloadURL(ref);
        await this.firestore.doc(`libraries/${libraryId}`).set({ photoUrl: url, updatedAt: new Date() }, { merge: true });
      }
      
      await loading.dismiss();
      await this.showSuccess('Account created successfully!');
      await this.router.navigate(['/dashboard'], { replaceUrl: true });
    } catch (error: any) {
      await loading.dismiss();
      this.showError(error.message || 'Signup failed');
    } finally {
      this.isLoading = false;
    }
  }

  onOwnerPhotoSelected(event: any) {
    const f: File | undefined = event?.target?.files?.[0];
    this.ownerPhotoFile = f || null;
  }

  onLibraryPhotoSelected(event: any) {
    const f: File | undefined = event?.target?.files?.[0];
    this.libraryPhotoFile = f || null;
  }

  async showError(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'danger'
    });
    await toast.present();
  }

  async showSuccess(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }

  get libraryName() {
    return this.signupForm.get('libraryName');
  }

  get city() {
    return this.signupForm.get('city');
  }

  get email() {
    return this.signupForm.get('email');
  }

  get totalSeats() {
    return this.signupForm.get('totalSeats');
  }

  get password() {
    return this.signupForm.get('password');
  }

  get confirmPassword() {
    return this.signupForm.get('confirmPassword');
  }
}
