import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss']
})
export class SignupPage implements OnInit {
  signupForm!: FormGroup;
  isLoading = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController
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
      const { email, password, libraryName, city, totalSeats } = this.signupForm.value;
      await this.authService.signup(email, password, libraryName, city, Number(totalSeats));
      
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
