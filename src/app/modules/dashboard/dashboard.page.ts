import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { Subscription, firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { StudentService } from '../../core/firestore/student.service';
import { FeeService } from '../../core/firestore/fee.service';
import { LibraryStateService } from '../../core/library-state.service';

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

  constructor(
    private authService: AuthService,
    private studentService: StudentService,
    private feeService: FeeService,
    private libraryStateService: LibraryStateService,
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
    this.loadDashboard();
  }

  ngOnDestroy() {
    this.seatsSub?.unsubscribe();
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
      }

      const [studentStats, feeStats] = await Promise.all([
        this.studentService.getStudentStats(),
        this.feeService.getFeeStats()
      ]);

      // Use the synchronous snapshot from LibraryStateService
      // (updated in real-time by the subscription above)
      const totalSeats = this.libraryStateService.currentTotalSeats;
      const totalCapacity = totalSeats > 0 ? totalSeats : studentStats.occupiedSeats;

      this.stats = {
        totalStudents: studentStats.total,
        totalFeesPending: feeStats.totalPending,
        totalFeesOverdue: feeStats.totalOverdue,
        monthlyRevenue: feeStats.monthlyRevenue,
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
