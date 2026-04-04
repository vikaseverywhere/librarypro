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

        <!-- LEFT: library switcher (main) OR back button (sub) -->
        <ion-buttons slot="start">
          <ion-back-button
            *ngIf="mode === 'sub'"
            [defaultHref]="backHref"
            text=""
            color="light">
          </ion-back-button>
          <app-library-switcher *ngIf="mode === 'main'"></app-library-switcher>
        </ion-buttons>

        <!-- CENTER: LibraryPro logo (main) or page title (sub) -->
        <ion-title *ngIf="mode === 'main'" class="lp-logo-title">
          <button class="lp-brand" (click)="goHome()" type="button" aria-label="Go to dashboard">
            <span class="lp-book-icon" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <!-- left pages - teal -->
                <path d="M2 26 L2 10 Q2 5.5 8 4.5 L15.5 4 L15.5 22.5 Q9 22.5 2 26 Z" fill="#4ECDC4"/>
                <!-- right pages - paper white (high contrast against blue header) -->
                <path d="M30 26 L30 10 Q30 5.5 24 4.5 L16.5 4 L16.5 22.5 Q23 22.5 30 26 Z" fill="rgba(255,255,255,0.92)"/>
                <!-- spine - gold accent matches "Pro" text -->
                <rect x="15.1" y="4" width="1.8" height="18.5" rx="0.9" fill="#FFD166"/>
                <!-- left page lines -->
                <line x1="5" y1="11" x2="14" y2="10.4" stroke="rgba(255,255,255,0.65)" stroke-width="1.3" stroke-linecap="round"/>
                <line x1="5" y1="15" x2="14" y2="14.6" stroke="rgba(255,255,255,0.65)" stroke-width="1.3" stroke-linecap="round"/>
                <line x1="5" y1="19" x2="14" y2="18.8" stroke="rgba(255,255,255,0.65)" stroke-width="1.3" stroke-linecap="round"/>
                <!-- right page lines - dark so visible on white -->
                <line x1="18" y1="10.4" x2="27" y2="11" stroke="rgba(34,100,160,0.4)" stroke-width="1.3" stroke-linecap="round"/>
                <line x1="18" y1="14.6" x2="27" y2="15" stroke="rgba(34,100,160,0.4)" stroke-width="1.3" stroke-linecap="round"/>
                <line x1="18" y1="18.8" x2="27" y2="19" stroke="rgba(34,100,160,0.4)" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
            </span>
            <span class="lp-wordmark">
              <span class="lp-lib">Library</span><span class="lp-pro">Pro</span>
            </span>
          </button>
        </ion-title>

        <ion-title *ngIf="mode === 'sub'" class="pro-title">{{ title }}</ion-title>

        <!-- RIGHT: avatar + logout (main) -->
        <ion-buttons slot="end" *ngIf="mode === 'main'">
          <div class="h-avatar" *ngIf="ownerPhotoUrl">
            <img [src]="ownerPhotoUrl" alt="Profile" />
          </div>
          <ion-button fill="clear" (click)="logout()" class="lp-logout-btn">
            <ion-icon name="log-out-outline" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>

      </ion-toolbar>
      <!-- bottom rainbow glow line -->
      <div class="lp-glowline"></div>
    </ion-header>
  `,
  styles: [`
    :host { display: block; }

    /* ── Avatar ── */
    .h-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid rgba(255,255,255,0.45);
      box-shadow: 0 2px 8px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.08);
      flex-shrink: 0;
      margin-right: 2px;
    }
    .h-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .lp-logout-btn {
      --color: rgba(255,255,255,0.85);
      --padding-start: 6px;
      --padding-end: 4px;
    }
    .lp-logout-btn ion-icon { font-size: 21px; }

    /* ── Logo center (main mode) ── */
    .lp-logo-title { pointer-events: none; }

    .lp-brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px 12px;
      border-radius: 14px;
      transition: background 0.18s ease, transform 0.15s ease;
      pointer-events: all;
      -webkit-tap-highlight-color: transparent;
      user-select: none;
    }
    .lp-brand:hover { background: rgba(255,255,255,0.08); }
    .lp-brand:active { background: rgba(255,255,255,0.14); transform: scale(0.96); }

    /* Book icon container */
    .lp-book-icon {
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.12);
      border-radius: 9px;
      border: 1px solid rgba(255,255,255,0.28);
      padding: 4px;
      box-sizing: border-box;
      flex-shrink: 0;
      box-shadow: 0 2px 10px rgba(0,0,0,0.18), inset 0 1px 1px rgba(255,255,255,0.2);
    }
    .lp-book-icon svg { width: 100%; height: 100%; display: block; }

    /* Wordmark */
    .lp-wordmark {
      display: inline-flex;
      align-items: baseline;
      line-height: 1;
      letter-spacing: -0.3px;
    }
    .lp-lib {
      font-size: 1.2rem;
      font-weight: 700;
      color: #ffffff;
      text-shadow: 0 1px 6px rgba(0,0,0,0.25);
    }
    .lp-pro {
      font-size: 1.3rem;
      font-weight: 900;
      font-style: italic;
      color: #FFD166;
      text-shadow: 0 1px 8px rgba(255,180,0,0.45);
    }

    /* ── Sub-page title ── */
    ion-title.pro-title { color: #fff; font-weight: 700; font-size: 1.05rem; }

    /* ── Glow accent line ── */
    .lp-glowline {
      height: 2px;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(51, 153, 204, 0.6) 15%,
        rgba(255, 209, 102, 0.95) 50%,
        rgba(51, 153, 204, 0.6) 85%,
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
