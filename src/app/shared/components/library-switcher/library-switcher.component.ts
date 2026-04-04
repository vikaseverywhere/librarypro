import { Component, OnInit } from '@angular/core';
import { ModalController, NavController, ToastController } from '@ionic/angular';
import { AuthService, UserProfile } from '../../../core/auth/auth.service';
import { LibraryService, Library } from '../../../core/firestore/library.service';
import { LibrarySwitcherModalComponent } from './library-switcher-modal.component';
import { filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-library-switcher',
  templateUrl: './library-switcher.component.html',
  styleUrls: ['./library-switcher.component.scss']
})
export class LibrarySwitcherComponent implements OnInit {
  activeLibraryId = '';
  activeLibraryName = '';
  activeLibraryCity = '';

  constructor(
    private authService: AuthService,
    private libraryService: LibraryService,
    private modalController: ModalController,
    private navController: NavController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.authService.userProfile.pipe(
      filter((p): p is UserProfile => !!p),
      take(1)
    ).subscribe(profile => {
      this.activeLibraryId = profile.libraryId;
      this.activeLibraryName = profile.libraryName;
      this.activeLibraryCity = profile.city || '';
    });
  }

  async openSwitcher() {
    const modal = await this.modalController.create({
      component: LibrarySwitcherModalComponent,
      componentProps: { activeLibraryId: this.activeLibraryId },
      cssClass: 'lib-switcher-modal'
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (!data) return;

    if (data.action === 'switch') {
      await this.switchLibrary(data.library);
    } else if (data.action === 'addNew') {
      this.navController.navigateForward('/tabs/libraries/add');
    }
  }

  private async switchLibrary(library: Library) {
    const libId = library.id || library.libraryId;
    if (!libId || libId === this.activeLibraryId) return;

    try {
      await this.libraryService.setActiveLibrary(libId);
      this.activeLibraryId = libId;
      this.activeLibraryName = library.name;
      this.activeLibraryCity = library.city || '';

      const toast = await this.toastController.create({
        message: `Switched to ${library.name}`,
        duration: 1800,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();
      this.navController.navigateRoot('/tabs/dashboard');
    } catch (e) {
      const toast = await this.toastController.create({
        message: 'Failed to switch library',
        duration: 2000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }
}
