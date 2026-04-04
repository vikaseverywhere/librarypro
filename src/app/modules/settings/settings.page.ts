import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavController, AlertController, ToastController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService, UserProfile } from '../../core/auth/auth.service';
import { FirestoreService } from '../../core/firestore/firestore.service';
import { LibraryStateService } from '../../core/library-state.service';
import { PlanService, Plan } from '../../core/firestore/plan.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss']
})
export class SettingsPage implements OnInit, OnDestroy {
  libraryName = '';
  ownerPhotoUrl = '';
  libraryPhotoUrl = '';
  city = '';
  totalSeats = 50;
  userEmail = '';
  plans: Plan[] = [];
  plansLoading = false;
  private userProfile: UserProfile | null = null;
  private seatsSub?: Subscription;

  // Inline editing state
  editing: { [key: string]: boolean } = {};
  editValues: { [key: string]: string | number } = {};
  isSaving: { [key: string]: boolean } = {};

  constructor(
    private navController: NavController,
    private authService: AuthService,
    private alertController: AlertController,
    private firestoreService: FirestoreService,
    private libraryStateService: LibraryStateService,
    private toastController: ToastController,
    private planService: PlanService
  ) {}

  ngOnInit() {
    // Subscribe to real-time capacity updates so settings always shows the current value
    this.seatsSub = this.libraryStateService.totalSeats$.subscribe(seats => {
      this.totalSeats = seats;
    });
    this.loadSettings();
  }

  ngOnDestroy() {
    this.seatsSub?.unsubscribe();
  }

  async ionViewWillEnter() {
    await this.loadSettings();
    await this.loadPlans();
  }

  async loadSettings() {
    this.userProfile = await this.getCurrentProfile();
    if (this.userProfile) {
      this.libraryName = this.userProfile.libraryName;
      this.city = this.userProfile.city || '';
      this.userEmail = this.userProfile.email || 'Not set';
      this.ownerPhotoUrl = String((this.userProfile as any).photoUrl || '');

      const libraryData: any = await this.firestoreService.getLibraryData(this.userProfile.libraryId);
      if (libraryData) {
        this.totalSeats = Number(libraryData.totalSeats ?? libraryData.seatCount ?? this.totalSeats);
        this.libraryPhotoUrl = String(libraryData.photoUrl || '');
      }
    }
  }

  async loadPlans() {
    this.plansLoading = true;
    try {
      this.plans = await this.planService.getActivePlans();
    } catch (e) {
      console.error('Error loading plans:', e);
    } finally {
      this.plansLoading = false;
    }
  }

  private async getCurrentProfile(): Promise<UserProfile | null> {
    const existing = this.authService.currentUserProfileValue;
    if (existing) {
      return existing;
    }

    try {
      return await firstValueFrom(
        this.authService.userProfile.pipe(
          filter((p): p is UserProfile => !!p),
          take(1)
        )
      );
    } catch {
      return null;
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 2200,
      position: 'bottom',
      color
    });
    await toast.present();
  }

  startEdit(field: string, currentValue: string | number) {
    this.editing[field] = true;
    this.editValues[field] = String(currentValue);
  }

  cancelEdit(field: string) {
    this.editing[field] = false;
  }

  async saveField(field: string) {
    this.userProfile = await this.getCurrentProfile();
    if (!this.userProfile) {
      await this.showToast('Unable to load library profile. Please re-login once.', 'danger');
      return;
    }
    const rawValue = this.editValues[field];
    const value = typeof rawValue === 'string'
      ? rawValue.trim()
      : String(rawValue ?? '').trim();
    if (!value) {
      await this.showToast('Please enter a valid value.', 'danger');
      return;
    }

    this.isSaving[field] = true;
    try {
      if (field === 'libraryName') {
        await this.firestoreService.updateLibrary(this.userProfile.libraryId, { libraryName: value, name: value });
        await this.authService.updateCurrentUserProfile({ libraryName: value });
        this.libraryName = value;

      } else if (field === 'city') {
        await this.firestoreService.updateLibrary(this.userProfile.libraryId, { city: value });
        await this.authService.updateCurrentUserProfile({ city: value });
        this.city = value;

      } else if (field === 'totalSeats') {
        const seats = parseInt(value, 10);
        if (isNaN(seats) || seats < 1) {
          await this.showToast('Please enter a valid seat count (minimum 1).', 'danger');
          return;
        }
        // LibraryStateService handles Firestore write + BehaviorSubject update
        await this.libraryStateService.updateTotalSeats(seats, this.userProfile.libraryId);
        // this.totalSeats will update automatically via the subscription in ngOnInit

      }

      this.editing[field] = false;
      await this.showToast('Saved successfully');
    } catch (error) {
      console.error(`Error saving ${field}:`, error);
      const message = error instanceof Error ? error.message : 'Please try again.';
      await this.showToast(`Failed to save. ${message}`, 'danger');
    } finally {
      this.isSaving[field] = false;
    }
  }

  async onChangePassword() {
    const inputAlert = await this.alertController.create({
      header: 'Change Password',
      inputs: [
        {
          name: 'currentPassword',
          type: 'password',
          placeholder: 'Current Password'
        },
        {
          name: 'newPassword',
          type: 'password',
          placeholder: 'New Password (min 8 chars)'
        },
        {
          name: 'confirmPassword',
          type: 'password',
          placeholder: 'Confirm New Password'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Update',
          handler: (data: any) => {
            const current = String(data?.currentPassword || '').trim();
            const newPwd = String(data?.newPassword || '').trim();
            const confirm = String(data?.confirmPassword || '').trim();

            if (!current || !newPwd || !confirm) {
              this.showToast('All fields are required.', 'danger');
              return false;
            }
            if (newPwd.length < 8) {
              this.showToast('New password must be at least 8 characters.', 'danger');
              return false;
            }
            if (newPwd !== confirm) {
              this.showToast('New password and confirmation do not match.', 'danger');
              return false;
            }
            if (current === newPwd) {
              this.showToast('New password must be different from current password.', 'danger');
              return false;
            }

            this.authService.changePassword(current, newPwd).then(() => {
              this.showToast('Password updated successfully.');
            }).catch((e: any) => {
              const msg = e?.message || '';
              if (msg.includes('wrong-password') || msg.includes('invalid-credential')) {
                this.showToast('Current password is incorrect.', 'danger');
              } else if (msg.includes('too-many-requests')) {
                this.showToast('Too many attempts. Please try again later.', 'danger');
              } else {
                this.showToast(`Failed to update password. ${msg}`, 'danger');
              }
            });
            return true;
          }
        }
      ]
    });
    await inputAlert.present();
  }

  getInitials(name: string): string {
    return String(name || '').split(/\s+/).filter(Boolean).map(n => n[0]).join('').toUpperCase();
  }

  async onLogout() {
    const alert = await this.alertController.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Logout',
          handler: async () => {
            await this.authService.logout();
            this.navController.navigateRoot('/auth/login');
          }
        }
      ]
    });
    await alert.present();
  }

  goBack() {
    this.navController.navigateBack('/tabs/dashboard');
  }

  goToLibraries() {
    this.navController.navigateForward('/tabs/libraries');
  }
}
