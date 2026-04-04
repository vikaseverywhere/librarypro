import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { PhotoUploadService } from '../../core/photo-upload.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss']
})
export class SignupPage implements OnInit, OnDestroy {
  signupForm!: FormGroup;
  isLoading = false;
  ownerPhotoFile: File | null = null;
  libraryPhotoFile: File | null = null;

  // Email verification state
  step: 'form' | 'verify' = 'form';
  isResending = false;
  resendCooldown = 0;
  private cooldownTimer: any;
  private pollTimer: any;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private firestore: AngularFirestore,
    private photoUploadService: PhotoUploadService
  ) {}

  ngOnInit() {
    this.initializeForm();
  }

  private initializeForm() {
    this.signupForm = this.formBuilder.group({
      libraryName: ['', [Validators.required, Validators.minLength(3)]],
      city: ['', [Validators.required]],
      totalSeats: [50, [Validators.required, Validators.min(1)]],
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
    this.step = 'form';
    this.resendCooldown = 0;
    clearInterval(this.cooldownTimer);
    this.stopPolling();
  }

  ngOnDestroy() {
    clearInterval(this.cooldownTimer);
    this.stopPolling();
  }

  passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  // Create account then show "check your email" step
  async onFormSubmit() {
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
      await this.createAccount();
      await loading.dismiss();
      this.step = 'verify';
      this.startResendCooldown();
      this.startPolling();
    } catch (error: any) {
      await loading.dismiss();
      this.showError(error.message || 'Signup failed');
    } finally {
      this.isLoading = false;
    }
  }

  private async createAccount() {
    const { email, password, libraryName, city, totalSeats } = this.signupForm.value;

    const profile = await this.authService.signup(
      email,
      password,
      libraryName,
      city,
      Number(totalSeats)
    );

    const libraryId = profile.libraryId;
    const uid = profile.uid;

    if (this.ownerPhotoFile) {
      const url = await this.photoUploadService.uploadPhoto(
        this.ownerPhotoFile, `users/${uid}/photo.jpg`, { maxSizePx: 720, quality: 0.7 }
      );
      await this.firestore.doc(`users/${uid}`).set({ photoUrl: url, updatedAt: new Date() }, { merge: true });
    }

    if (this.libraryPhotoFile) {
      const url = await this.photoUploadService.uploadPhoto(
        this.libraryPhotoFile, `libraries/${libraryId}/photo.jpg`, { maxSizePx: 900, quality: 0.72 }
      );
      await this.firestore.doc(`libraries/${libraryId}`).set({ photoUrl: url, updatedAt: new Date() }, { merge: true });
    }
  }

  private startResendCooldown() {
    this.resendCooldown = 60;
    clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      this.resendCooldown--;
      if (this.resendCooldown <= 0) {
        clearInterval(this.cooldownTimer);
      }
    }, 1000);
  }

  async resendEmail() {
    if (this.resendCooldown > 0) return;
    this.isResending = true;
    try {
      await this.authService.resendVerificationEmail();
      this.showSuccess('New verification email sent! Use only this latest link.');
      this.startResendCooldown();
    } catch (e: any) {
      this.showError(e?.message || 'Failed to resend email.');
    } finally {
      this.isResending = false;
    }
  }

  async checkVerified() {
    const loading = await this.loadingController.create({ message: 'Checking...' });
    await loading.present();
    try {
      const verified = await this.authService.reloadUser();
      await loading.dismiss();
      if (verified) {
        this.stopPolling();
        await this.showSuccess('Email verified! Redirecting...');
        await this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
      } else {
        this.showError('Email not yet verified. Please click the LATEST link in your email.');
      }
    } catch (e: any) {
      await loading.dismiss();
      this.showError('Could not check verification status.');
    }
  }

  private startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(async () => {
      try {
        const verified = await this.authService.reloadUser();
        if (verified) {
          this.stopPolling();
          await this.showSuccess('Email verified! Redirecting...');
          await this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
        }
      } catch (_) { /* silent */ }
    }, 3000);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  goBackToForm() {
    this.step = 'form';
    clearInterval(this.cooldownTimer);
    this.stopPolling();
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
