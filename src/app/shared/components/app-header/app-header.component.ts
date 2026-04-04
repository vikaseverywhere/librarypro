import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NavController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService, UserProfile } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-header',
  template: `
    <ion-header class="lp-header">
      <ion-toolbar class="pro-toolbar">

        <!-- LEFT: logo icon (main → goes home) OR back button (sub) -->
        <ion-buttons slot="start">
          <!-- Sub-page: back -->
          <ion-back-button
            *ngIf="mode === 'sub'"
            [defaultHref]="backHref"
            text=""
            color="light">
          </ion-back-button>

          <!-- Main: book logo → dashboard -->
          <button *ngIf="mode === 'main'"
            class="lp-logo-btn"
            (click)="goHome()"
            type="button"
            aria-label="Go to dashboard">
            <span class="lp-book-icon" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 26 L2 10 Q2 5.5 8 4.5 L15.5 4 L15.5 22.5 Q9 22.5 2 26 Z" fill="#4ECDC4"/>
                <path d="M30 26 L30 10 Q30 5.5 24 4.5 L16.5 4 L16.5 22.5 Q23 22.5 30 26 Z" fill="rgba(255,255,255,0.92)"/>
                <rect x="15.1" y="4" width="1.8" height="18.5" rx="0.9" fill="#FFD166"/>
                <line x1="5"  y1="11"   x2="14" y2="10.4" stroke="rgba(255,255,255,0.65)" stroke-width="1.3" stroke-linecap="round"/>
                <line x1="5"  y1="15"   x2="14" y2="14.6" stroke="rgba(255,255,255,0.65)" stroke-width="1.3" stroke-linecap="round"/>
                <line x1="5"  y1="19"   x2="14" y2="18.8" stroke="rgba(255,255,255,0.65)" stroke-width="1.3" stroke-linecap="round"/>
                <line x1="18" y1="10.4" x2="27" y2="11"   stroke="rgba(34,100,160,0.4)"  stroke-width="1.3" stroke-linecap="round"/>
                <line x1="18" y1="14.6" x2="27" y2="15"   stroke="rgba(34,100,160,0.4)"  stroke-width="1.3" stroke-linecap="round"/>
                <line x1="18" y1="18.8" x2="27" y2="19"   stroke="rgba(34,100,160,0.4)"  stroke-width="1.3" stroke-linecap="round"/>
              </svg>
            </span>
          </button>
        </ion-buttons>

        <!-- CENTER: library switcher (main) or page title (sub) -->
        <ion-title class="lp-center-title">
          <ng-container *ngIf="mode === 'main'">
            <app-library-switcher></app-library-switcher>
          </ng-container>
          <ng-container *ngIf="mode === 'sub'">
            <span class="sub-title-text">{{ title }}</span>
          </ng-container>
        </ion-title>

        <!-- RIGHT: avatar + logout (main) -->
        <ion-buttons slot="end" *ngIf="mode === 'main'">
          <div class="h-avatar" *ngIf="ownerPhotoUrl">
            <img [src]="ownerPhotoUrl" alt="Profile" />
          </div>
          <div class="h-avatar h-avatar--initial" *ngIf="!ownerPhotoUrl && initials">
            {{ initials }}
          </div>
          <ion-button fill="clear" (click)="logout()" class="lp-logout-btn">
            <ion-icon name="log-out-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>

      </ion-toolbar>
      <div class="lp-glowline"></div>
    </ion-header>
  `,
  styles: [`
    :host { display: block; }

    /* ── Logo button (left) ── */
    .lp-logo-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px 8px 6px 10px;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
      border-radius: 12px;
      transition: background 0.15s ease, transform 0.13s ease;
    }
    .lp-logo-btn:active { background: rgba(255,255,255,0.12); transform: scale(0.93); }

    .lp-book-icon {
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.13);
      border-radius: 10px;
      border: 1.5px solid rgba(255,255,255,0.3);
      padding: 4px;
      box-sizing: border-box;
      box-shadow: 0 2px 12px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.22);
    }
    .lp-book-icon svg { width: 100%; height: 100%; display: block; }

    /* ── Center title slot ── */
    .lp-center-title {
      /* Allow the switcher inside to be interactive */
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .lp-center-title > * { pointer-events: all; }

    /* Sub-page title */
    .sub-title-text {
      color: #fff;
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: 0.1px;
    }

    /* ── Avatar ── */
    .h-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid rgba(255,255,255,0.45);
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      flex-shrink: 0;
      margin-right: 1px;
    }
    .h-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .h-avatar--initial {
      background: linear-gradient(135deg, #FFD166 0%, #f0a500 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.72rem;
      font-weight: 800;
      color: #1a3a6b;
      overflow: hidden;
    }

    .lp-logout-btn {
      --color: rgba(255,255,255,0.85);
      --padding-start: 4px;
      --padding-end: 6px;
    }
    .lp-logout-btn ion-icon { font-size: 20px; }

    /* ── Glow accent line ── */
    .lp-glowline {
      height: 2.5px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(51,153,204,0.5) 10%,
        rgba(255,209,102,1) 50%,
        rgba(51,153,204,0.5) 90%,
        transparent 100%
      );
    }
  `]
})
export class AppHeaderComponent implements OnInit, OnDestroy {
  @Input() mode: 'main' | 'sub' = 'main';
  @Input() title = '';
  @Input() backHref = '/tabs/dashboard';

  ownerPhotoUrl = '';
  initials = '';
  private sub?: Subscription;

  constructor(
    private authService: AuthService,
    private navCtrl: NavController
  ) {}

  ngOnInit() {
    this.sub = this.authService.userProfile
      .pipe(filter((p): p is UserProfile => !!p))
      .subscribe(profile => {
        this.ownerPhotoUrl = (profile as any).photoUrl || '';
        const name: string = (profile as any).displayName || (profile as any).libraryName || '';
        this.initials = name
          .split(' ')
          .slice(0, 2)
          .map((w: string) => w[0])
          .join('')
          .toUpperCase();
      });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  goHome() {
    this.navCtrl.navigateRoot('/tabs/dashboard', { animationDirection: 'back' });
  }

  async logout() {
    await this.authService.logout();
    this.navCtrl.navigateRoot('/auth/login');
  }
}
