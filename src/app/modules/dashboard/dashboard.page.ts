import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { StudentService } from '../../core/firestore/student.service';
import { FeeStateService } from '../../core/fee-state.service';
import { LibraryStateService } from '../../core/library-state.service';
import { FirestoreService } from '../../core/firestore/firestore.service';

interface DashboardStats {
  totalStudents: number;
  totalFeesPending: number;
  totalFeesOverdue: number;
  monthlyRevenue: number;
  totalCapacity: number;
  occupiedSeats: number;
  vacantSeats: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss']
})
export class DashboardPage implements OnInit, OnDestroy {
  libraryName = '';
  ownerPhotoUrl = '';
  libraryPhotoUrl = '';
  currentDate = new Date();
  stats: DashboardStats = {
    totalStudents: 0,
    totalFeesPending: 0,
    totalFeesOverdue: 0,
    monthlyRevenue: 0,
    totalCapacity: 0,
    occupiedSeats: 0,
    vacantSeats: 0
  };
  isLoading = true;
  isEditingCapacity = false;
  capacityInput = '1';
  isSavingCapacity = false;

  private seatsSub?: Subscription;
  private feeStatsSub?: Subscription;

  constructor(
    private authService: AuthService,
    private studentService: StudentService,
    private feeStateService: FeeStateService,
    private libraryStateService: LibraryStateService,
    private firestoreService: FirestoreService,
    private router: Router,
    private alertController: AlertController,
    private navController: NavController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    // React to capacity changes from anywhere in the app (dashboard edit or settings)
    this.seatsSub = this.libraryStateService.totalSeats$.subscribe(seats => {
      const totalCapacity = seats > 0 ? seats : this.stats.occupiedSeats;
      this.stats.totalCapacity = totalCapacity;
      this.stats.vacantSeats = Math.max(totalCapacity - this.stats.occupiedSeats, 0);
    });

    this.feeStatsSub = this.feeStateService.feeStats$.subscribe((feeStats) => {
      this.stats = {
        ...this.stats,
        totalFeesPending: feeStats.totalPending,
        totalFeesOverdue: feeStats.totalOverdue,
        monthlyRevenue: feeStats.monthlyRevenue
      };
    });

    this.loadDashboard();
  }

  ngOnDestroy() {
    this.seatsSub?.unsubscribe();
    this.feeStatsSub?.unsubscribe();
  }

  ionViewWillEnter() {
    // Reload student & fee stats on every navigation; capacity stays in sync via subscription
    this.loadDashboard();
  }

  private async getCurrentProfile() {
    const existing = this.authService.currentUserProfileValue;
    if (existing) return existing;
    return firstValueFrom(
      this.authService.userProfile.pipe(
        filter((p): p is NonNullable<typeof p> => !!p),
        take(1)
      )
    );
  }

  async loadDashboard() {
    this.isLoading = true;
    try {
      const profile = await this.getCurrentProfile();
      if (profile) {
        this.libraryName = profile.libraryName;
        this.ownerPhotoUrl = String((profile as any).photoUrl || '');
      }

      try {
        const lib: any = await this.firestoreService.getCurrentLibraryData();
        this.libraryPhotoUrl = String(lib?.photoUrl || '');
      } catch {
        this.libraryPhotoUrl = '';
      }

      const studentStats = await this.studentService.getStudentStats();

      // Use the synchronous snapshot from LibraryStateService
      // (updated in real-time by the subscription above)
      const totalSeats = this.libraryStateService.currentTotalSeats;
      const totalCapacity = totalSeats > 0 ? totalSeats : studentStats.occupiedSeats;

      this.stats = {
        totalStudents: studentStats.total,
        totalFeesPending: this.stats.totalFeesPending,
        totalFeesOverdue: this.stats.totalFeesOverdue,
        monthlyRevenue: this.stats.monthlyRevenue,
        totalCapacity,
        occupiedSeats: studentStats.occupiedSeats,
        vacantSeats: Math.max(totalCapacity - studentStats.occupiedSeats, 0)
      };
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      this.isLoading = false;
    }
  }

  startCapacityEdit() {
    // Use the live value from the service to pre-fill the input (never empty)
    const current = this.libraryStateService.currentTotalSeats || this.stats.totalCapacity || 1;
    this.capacityInput = String(current);
    this.isEditingCapacity = true;
  }

  cancelCapacityEdit() {
    this.isEditingCapacity = false;
  }

  async saveCapacity() {
    const seats = parseInt(this.capacityInput, 10);
    if (isNaN(seats) || seats < 1) {
      await this.showToast('Please enter a valid total capacity (minimum 1).', 'danger');
      return;
    }
    if (seats < this.stats.occupiedSeats) {
      await this.showToast(
        `Cannot set capacity below current occupied seats (${this.stats.occupiedSeats}).`,
        'danger'
      );
      return;
    }

    this.isSavingCapacity = true;
    try {
      await this.libraryStateService.updateTotalSeats(seats);
      // stats.totalCapacity & vacantSeats update automatically via the totalSeats$ subscription
      this.isEditingCapacity = false;
      await this.showToast('Total capacity updated successfully.');
    } catch (error) {
      console.error('Error saving capacity:', error);
      await this.showToast('Failed to update capacity. Please try again.', 'danger');
    } finally {
      this.isSavingCapacity = false;
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  navigateToStudents() {
    this.navController.navigateForward('/students');
  }

  navigateToFees() {
    this.navController.navigateForward('/fees');
  }

  navigateToSettings() {
    this.navController.navigateForward('/settings');
  }

  navigateToLibraries() {
    this.navController.navigateForward('/libraries');
  }

  navigateToReceipts() {
    this.navController.navigateForward('/transactions');
  }

  onQuickAddStudent() {
    this.navController.navigateForward('/students/add');
  }

  onQuickCollectFees() {
    this.navController.navigateForward('/fees/collect');
  }

  onQuickSettings() {
    this.navController.navigateForward('/settings');
  }

  onQuickViewStudents() {
    this.navController.navigateForward('/students');
  }

  async onLogout() {
    const alert = await this.alertController.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Logout',
          handler: async () => {
            await this.authService.logout();
            this.router.navigate(['/auth/login']);
          }
        }
      ]
    });
    await alert.present();
  }
}
