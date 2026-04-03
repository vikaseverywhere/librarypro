import { Component, OnInit } from '@angular/core';
import { NavController, ToastController } from '@ionic/angular';
import { LibraryService } from '../../core/firestore/library.service';
import { AuthService } from '../../core/auth/auth.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { PhotoUploadService } from '../../core/photo-upload.service';

@Component({
  selector: 'app-library-create',
  templateUrl: './library-create.page.html',
  styleUrls: ['./library-create.page.scss']
})
export class LibraryCreatePage implements OnInit {
  name = '';
  city = '';
  totalSeats: number = 50;
  monthlyFee: number = 5000;
  libraryPhotoFile: File | null = null;
  isSaving = false;

  constructor(
    private navController: NavController,
    private toastController: ToastController,
    private libraryService: LibraryService,
    private authService: AuthService,
    private firestore: AngularFirestore,
    private photoUploadService: PhotoUploadService
  ) {}

  ngOnInit() {}

  async onSubmit() {
    const n = this.name.trim();
    const c = this.city.trim();
    const seats = Number(this.totalSeats);
    const fee = Number(this.monthlyFee);

    if (!n) {
      await this.toast('Please enter library name.', 'danger');
      return;
    }
    if (!c) {
      await this.toast('Please enter city.', 'danger');
      return;
    }
    if (!Number.isFinite(seats) || seats < 1) {
      await this.toast('Total seats must be >= 1.', 'danger');
      return;
    }
    if (!Number.isFinite(fee) || fee < 0) {
      await this.toast('Monthly fee must be >= 0.', 'danger');
      return;
    }

    this.isSaving = true;
    try {
      const libraryId = await this.libraryService.createLibrary({
        name: n,
        city: c,
        totalSeats: seats,
        monthlyFee: fee
      });

      // Upload optional library photo (compressed to data URL, stored in Firestore)
      if (this.libraryPhotoFile) {
        const dataUrl = await this.photoUploadService.compressToDataUrl(
          this.libraryPhotoFile, { maxSizePx: 900, quality: 0.72 }
        );
        await this.firestore.doc(`libraries/${libraryId}`).set(
          { photoUrl: dataUrl, updatedAt: new Date() }, { merge: true }
        );
      }

      await this.toast('Library created and set as active.', 'success');
      this.navController.navigateRoot('/dashboard');
    } catch (error) {
      console.error('createLibrary error:', error);
      await this.toast(error instanceof Error ? error.message : 'Failed to create library.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  onLibraryPhotoSelected(event: any) {
    const f: File | undefined = event?.target?.files?.[0];
    this.libraryPhotoFile = f || null;
  }

  private async toast(message: string, color: 'success' | 'danger') {
    const t = await this.toastController.create({
      message,
      duration: 2400,
      color,
      position: 'bottom'
    });
    await t.present();
  }

  goBack() {
    this.navController.navigateBack('/libraries');
  }
}

