import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavController, AlertController, ToastController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService, UserProfile } from '../../core/auth/auth.service';
import { FirestoreService } from '../../core/firestore/firestore.service';
import { LibraryStateService } from '../../core/library-state.service';

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
  monthlyFee = 5000;
  userEmail = '';
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
    private toastController: ToastController
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
        this.monthlyFee = Number(libraryData.monthlyFee ?? this.monthlyFee);
        this.libraryPhotoUrl = String(libraryData.photoUrl || '');
      }
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

      } else if (field === 'monthlyFee') {
        const fee = parseInt(value, 10);
        if (isNaN(fee) || fee < 0) {
          await this.showToast('Please enter a valid fee amount.', 'danger');
          return;
        }
        await this.firestoreService.updateLibrary(this.userProfile.libraryId, { monthlyFee: fee });
        this.monthlyFee = fee;
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
    const alert = await this.alertController.create({
      header: 'Change Password',
      message: 'A password reset link will be sent to your email.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Send Reset Link', handler: () => { /* integrate email reset */ } }
      ]
    });
    await alert.present();
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
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
    this.navController.navigateBack('/dashboard');
  }

  goToLibraries() {
    this.navController.navigateForward('/libraries');
  }
}
