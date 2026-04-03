import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  showVerifyBanner = false;
  isResendingVerification = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ionViewWillEnter() {
    if (this.loginForm) {
      this.loginForm.reset();
    }
    this.showVerifyBanner = false;
  }

  async onLogin() {
    if (this.loginForm.invalid) {
      this.showError('Please fill all fields correctly');
      return;
    }

    this.isLoading = true;
    this.showVerifyBanner = false;
    const loading = await this.loadingController.create({
      message: 'Logging in...'
    });
    await loading.present();

    try {
      const { email, password } = this.loginForm.value;
      await this.authService.login(email, password);

      // Reload to get fresh emailVerified status from Firebase
      const verified = await this.authService.reloadUser();
      if (!verified) {
        await loading.dismiss();
        this.showVerifyBanner = true;
        this.showError('Please verify your email first. Check your inbox.');
        return;
      }

      await loading.dismiss();
      await this.router.navigate(['/dashboard'], { replaceUrl: true });
    } catch (error: any) {
      await loading.dismiss();
      this.showError(error.message || 'Login failed');
    } finally {
      this.isLoading = false;
    }
  }

  async resendVerification() {
    this.isResendingVerification = true;
    try {
      await this.authService.resendVerificationEmail();
      const toast = await this.toastController.create({
        message: 'Verification email sent! Check your inbox.',
        duration: 3000,
        position: 'bottom',
        color: 'success'
      });
      await toast.present();
    } catch (e: any) {
      this.showError('Failed to resend verification email.');
    } finally {
      this.isResendingVerification = false;
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

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }
}
