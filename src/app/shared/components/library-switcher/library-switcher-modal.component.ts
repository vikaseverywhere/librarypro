import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Library, LibraryService } from '../../../core/firestore/library.service';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-library-switcher-modal',
  template: `
    <div class="sw-wrap">

      <!-- Header -->
      <div class="sw-head">
        <div class="sw-head-left">
          <div class="sw-head-icon">
            <ion-icon name="business-outline"></ion-icon>
          </div>
          <div>
            <div class="sw-head-title">My Libraries</div>
            <div class="sw-head-sub">Select or add a library</div>
          </div>
        </div>
        <button class="sw-close" (click)="dismiss()">
          <ion-icon name="close"></ion-icon>
        </button>
      </div>

      <!-- Library List -->
      <div class="sw-body">
        <div class="sw-loading" *ngIf="isLoading">
          <ion-spinner name="crescent" color="primary"></ion-spinner>
          <span>Loading…</span>
        </div>

        <div class="sw-empty" *ngIf="!isLoading && libraries.length === 0">
          <ion-icon name="library-outline"></ion-icon>
          <span>No libraries found</span>
        </div>

        <div
          class="sw-item"
          *ngFor="let lib of libraries"
          [class.sw-active]="(lib.id || lib.libraryId) === activeLibraryId"
          (click)="select(lib)"
        >
          <div class="sw-avatar">
            <ion-icon name="business"></ion-icon>
          </div>
          <div class="sw-info">
            <span class="sw-name">{{ lib.name }}</span>
            <span class="sw-city" *ngIf="lib.city">
              <ion-icon name="location-outline"></ion-icon> {{ lib.city }}
            </span>
          </div>
          <div class="sw-tick" *ngIf="(lib.id || lib.libraryId) === activeLibraryId">
            <ion-icon name="checkmark"></ion-icon>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="sw-footer">
        <button class="sw-add-btn" (click)="addNew()">
          <ion-icon name="add-circle-outline"></ion-icon>
          Add New Library
        </button>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .sw-wrap {
      background: #fff;
      border-radius: 20px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    .sw-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 16px 14px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
    }

    .sw-head-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .sw-head-icon {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: rgba(255,255,255,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      ion-icon { font-size: 22px; color: #fff; }
    }

    .sw-head-title {
      font-size: 1rem;
      font-weight: 700;
      color: #fff;
    }

    .sw-head-sub {
      font-size: 0.72rem;
      color: rgba(255,255,255,0.75);
      margin-top: 1px;
    }

    .sw-close {
      background: rgba(255,255,255,0.15);
      border: none;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
      flex-shrink: 0;
    }

    /* ── Body ── */
    .sw-body {
      overflow-y: auto;
      max-height: 300px;
      padding: 8px 0;
    }

    .sw-loading, .sw-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 32px 16px;
      color: #94a3b8;
      font-size: 0.85rem;
      ion-icon { font-size: 28px; }
    }

    .sw-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.12s;
    }

    .sw-item:not(:last-child) { border-bottom: 1px solid #f1f5f9; }
    .sw-item:active { background: #f8fafc; }

    .sw-item.sw-active { background: #f5f3ff; }
    .sw-item.sw-active .sw-name { color: #5b21b6; font-weight: 700; }
    .sw-item.sw-active .sw-avatar {
      background: #ede9fe;
      ion-icon { color: #7c3aed; }
    }

    .sw-avatar {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      ion-icon { font-size: 20px; color: #94a3b8; }
    }

    .sw-info { flex: 1; min-width: 0; }

    .sw-name {
      display: block;
      font-size: 0.92rem;
      font-weight: 600;
      color: #1e293b;
    }

    .sw-city {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 0.73rem;
      color: #64748b;
      margin-top: 2px;
      ion-icon { font-size: 11px; }
    }

    .sw-tick {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #7c3aed;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      ion-icon { font-size: 16px; color: #fff; }
    }

    /* ── Footer ── */
    .sw-footer {
      padding: 12px 16px 16px;
      border-top: 1px solid #f1f5f9;
    }

    .sw-add-btn {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px;
      background: #f5f3ff;
      border: 2px dashed #c4b5fd;
      border-radius: 12px;
      color: #5b21b6;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      ion-icon { font-size: 20px; }
    }

    .sw-add-btn:active {
      background: #ede9fe;
      border-color: #7c3aed;
    }
  `]
})
export class LibrarySwitcherModalComponent implements OnInit {
  @Input() activeLibraryId = '';

  libraries: Library[] = [];
  isLoading = true;

  constructor(
    private modalCtrl: ModalController,
    private libraryService: LibraryService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    try {
      this.libraries = await this.libraryService.listOwnedLibraries();
      const profile = this.authService.currentUserProfileValue;
      if (profile) this.activeLibraryId = profile.libraryId;
    } catch (e) {
      console.error('Modal: failed to load libraries', e);
    } finally {
      this.isLoading = false;
    }
  }

  dismiss() { this.modalCtrl.dismiss(null); }

  select(lib: Library) {
    this.modalCtrl.dismiss({ action: 'switch', library: lib });
  }

  addNew() {
    this.modalCtrl.dismiss({ action: 'addNew' });
  }
}
