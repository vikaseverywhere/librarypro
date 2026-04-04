import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavController, ToastController, AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService, UserProfile } from '../../core/auth/auth.service';
import { LibraryService, Library } from '../../core/firestore/library.service';

@Component({
  selector: 'app-libraries',
  templateUrl: './libraries.page.html',
  styleUrls: ['./libraries.page.scss']
})
export class LibrariesPage implements OnInit, OnDestroy {
  libraries: Library[] = [];
  activeLibraryId = '';
  isLoading = false;
  libraryName = '';
  userEmail = '';

  constructor(
    private navController: NavController,
    private toastController: ToastController,
    private alertController: AlertController,
    private authService: AuthService,
    private libraryService: LibraryService
  ) {}

  ngOnInit() {
    void this.load();
  }

  ngOnDestroy() {
    // no-op (kept for future)
  }

  async ionViewWillEnter() {
    await this.load();
  }

  private async getCurrentProfile(): Promise<UserProfile | null> {
    const existing = this.authService.currentUserProfileValue;
    if (existing) return existing;

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

  async load() {
    this.isLoading = true;
    try {
      const profile = await this.getCurrentProfile();
      if (!profile) return;

      this.activeLibraryId = profile.libraryId;
      this.libraryName = profile.libraryName || '';
      this.userEmail = profile.email || '';
      this.libraries = await this.libraryService.listOwnedLibraries();
    } finally {
      this.isLoading = false;
    }
  }

  async onAddLibrary() {
    this.navController.navigateForward('/tabs/libraries/add');
  }

  async useLibrary(libraryId: string) {
    if (!libraryId) return;

    try {
      await this.libraryService.setActiveLibrary(libraryId);
      this.activeLibraryId = libraryId;

      const toast = await this.toastController.create({
        message: 'Active library updated.',
        duration: 2200,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();

      this.navController.navigateRoot('/tabs/dashboard');
    } catch (error) {
      console.error('useLibrary error:', error);
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : 'Failed to switch library.',
        duration: 2600,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }

  getLibrarySeats(lib: Library): number {
    const v = lib.totalSeats ?? lib.seatCount;
    return Number(v ?? 0);
  }

  async onDeleteLibrary(lib: Library) {
    if (lib.libraryId === this.activeLibraryId) {
      const toast = await this.toastController.create({
        message: 'Switch to another library before deleting this one.',
        duration: 2500,
        color: 'warning',
        position: 'bottom'
      });
      await toast.present();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Delete Library',
      message: `Are you sure you want to delete <strong>${lib.name}</strong>? This action cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.confirmDeleteLibrary(lib)
        }
      ]
    });
    await alert.present();
  }

  private async confirmDeleteLibrary(lib: Library) {
    try {
      await this.libraryService.deleteLibrary(lib.libraryId);
      this.libraries = this.libraries.filter(l => l.libraryId !== lib.libraryId);
      const toast = await this.toastController.create({
        message: `"${lib.name}" deleted.`,
        duration: 2200,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();
    } catch (error) {
      const toast = await this.toastController.create({
        message: error instanceof Error ? error.message : 'Failed to delete library.',
        duration: 2600,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }
}

