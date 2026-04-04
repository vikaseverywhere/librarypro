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

  // Brute-force throttle: 3 failures → 30s lockout.
  private failedAttempts = 0;
  private lockedUntil = 0;
  private readonly MAX_ATTEMPTS = 3;
  private readonly LOCKOUT_SECONDS = 30;

  get isLockedOut(): boolean { return Date.now() < this.lockedUntil; }
  get lockoutSecondsLeft(): number { return Math.ceil((this.lockedUntil - Date.now()) / 1000); }

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
    // Restore persisted lockout so navigating away and back doesn't reset it
    const stored = sessionStorage.getItem('login_locked_until');
    this.lockedUntil = stored ? Number(stored) : 0;
    this.failedAttempts = Number(sessionStorage.getItem('login_failed_attempts') || '0');
  }

  async onLogin() {
    if (this.isLockedOut) {
      this.showError(`Too many failed attempts. Try again in ${this.lockoutSecondsLeft}s.`);
      return;
    }

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

      const verified = await this.authService.reloadUser();
      if (!verified) {
        await loading.dismiss();
        this.showVerifyBanner = true;
        this.showError('Please verify your email first. Check your inbox.');
        return;
      }

      // Successful login — reset throttle counter.
      this.failedAttempts = 0;
      sessionStorage.removeItem('login_failed_attempts');
      sessionStorage.removeItem('login_locked_until');
      await loading.dismiss();
      await this.router.navigate(['/tabs/dashboard'], { replaceUrl: true });
    } catch (error: any) {
      await loading.dismiss();
      this.failedAttempts++;
      if (this.failedAttempts >= this.MAX_ATTEMPTS) {
        this.lockedUntil = Date.now() + this.LOCKOUT_SECONDS * 1000;
        this.failedAttempts = 0;
        sessionStorage.setItem('login_locked_until', String(this.lockedUntil));
        sessionStorage.removeItem('login_failed_attempts');
        this.showError(`Too many failed attempts. Account locked for ${this.LOCKOUT_SECONDS} seconds.`);
      } else {
        sessionStorage.setItem('login_failed_attempts', String(this.failedAttempts));
        const remaining = this.MAX_ATTEMPTS - this.failedAttempts;
        this.showError(`${error.message || 'Login failed'}. ${remaining} attempt${remaining > 1 ? 's' : ''} remaining.`);
      }
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
