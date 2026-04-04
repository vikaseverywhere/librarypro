import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore, DocumentSnapshot } from '@angular/fire/compat/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

export interface UserProfile {
  uid: string;
  email: string;
  // Active library context used by the existing app/services.
  libraryId: string;
  libraryName: string;
  // All libraries the owner/admin has access to.
  // Kept optional for backward compatibility with older user documents.
  libraryIds?: string[];
  city: string;
  // For now you want Owner fixed as admin.
  role: 'admin' | 'librarian';
  photoUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUser$ = new BehaviorSubject<any | null>(null);
  private userProfile$ = new BehaviorSubject<UserProfile | null>(null);
  private isAuthenticated$ = new BehaviorSubject<boolean>(false);
  private authResolved$ = new BehaviorSubject<boolean>(false);
  /** Live subscription to the user document — swapped on each login, cleared on logout. */
  private profileSub?: { unsubscribe(): void };

  constructor(
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore
  ) {
    // Keep browser sessions stable across refreshes.
    // (Prevents the "flash logout/login" feeling on reloads.)
    void this.afAuth.setPersistence('local').catch(() => {});
    this.initializeAuth();
  }

  private initializeAuth() {
    this.afAuth.authState.subscribe(async (user) => {
      this.currentUser$.next(user);
      if (user) {
        this.loadUserProfile(user.uid);
        this.isAuthenticated$.next(true);
      } else {
        this.userProfile$.next(null);
        this.isAuthenticated$.next(false);
      }

      // Mark auth status as resolved on first authState emission.
      if (!this.authResolved$.value) {
        this.authResolved$.next(true);
      }
    });
  }

  private loadUserProfile(uid: string) {
    // Unsubscribe previous listener before starting a new one (e.g. library switch).
    this.profileSub?.unsubscribe();
    const userRef = this.firestore.doc<UserProfile>(`users/${uid}`);
    this.profileSub = userRef.valueChanges().subscribe({
      next: (data) => {
        if (data) {
          this.userProfile$.next(data as UserProfile);
        }
      },
      error: (error) => {
        console.error('Error loading user profile:', error);
      }
    });
  }

  async signup(
    email: string,
    password: string,
    libraryName: string,
    city: string,
    totalSeats: number
  ) {
    try {
      const userCredential = await this.afAuth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      if (!user) throw new Error('User creation failed');

      // Send Firebase's free email verification link
      await user.sendEmailVerification();

      const uid = user.uid;

      // Generate libraryId
      const libraryId = `lib_${uid.substring(0, 12)}`;

      // Create user profile
      const userProfile: UserProfile = {
        uid,
        email,
        libraryId,
        libraryName,
        libraryIds: [libraryId],
        city,
        role: 'admin',
        photoUrl: ''
      };

      // Save to Firestore
      await this.firestore.doc(`users/${uid}`).set(userProfile);
      
      // Create library document
      await this.firestore.doc(`libraries/${libraryId}`).set({
        libraryId,
        name: libraryName,
        ownerEmail: email,
        city,
        country: 'IN',
        subscriptionPlan: 'free',
        subscriptionStatus: 'active',
        subscriptionStartDate: new Date(),
        subscriptionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days free trial
        subscriptionAmount: 0,
        totalSeats,
        seatCount: totalSeats,
        shifts: [],
        photoUrl: '',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: email
      });

      // Set custom claims (done via Cloud Function in production)
      this.userProfile$.next(userProfile);
      return userProfile;
    } catch (error: any) {
      // Keep user record intact if the profile was saved, but forward a safe message
      console.error('Signup error (possible non-fatal):', error);
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Email already is in use. Please log in or use another email.');
      }
      throw new Error('Signup failed. Please check your connection and try again.');
    }
  }

  async login(email: string, password: string) {
    try {
      const userCredential = await this.afAuth.signInWithEmailAndPassword(email, password);
      const user = userCredential.user;
      if (!user) throw new Error('Login failed');
      const uid = user.uid;
      this.loadUserProfile(uid);
      return this.userProfile$.value;
    } catch (error: any) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.afAuth.currentUser;
    if (!user || !user.email) throw new Error('No authenticated user.');

    // Firebase requires recent sign-in before sensitive operations.
    const { EmailAuthProvider } = await import('firebase/auth');
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await (user as any).reauthenticateWithCredential(credential);
    await (user as any).updatePassword(newPassword);
  }

  async logout() {
    try {
      this.profileSub?.unsubscribe();
      this.profileSub = undefined;
      await this.afAuth.signOut();
      this.currentUser$.next(null);
      this.userProfile$.next(null);
      this.isAuthenticated$.next(false);
    } catch (error: any) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  async updateCurrentUserProfile(data: Partial<UserProfile>) {
    try {
      const currentUser = this.currentUserValue;
      if (!currentUser?.uid) {
        throw new Error('No authenticated user found');
      }

      await this.firestore.doc(`users/${currentUser.uid}`).update({
        ...data
      });

      const currentProfile = this.currentUserProfileValue;
      if (currentProfile) {
        this.userProfile$.next({
          ...currentProfile,
          ...data
        });
      }
    } catch (error: any) {
      throw new Error(`Profile update failed: ${error.message || 'Unknown error'}`);
    }
  }

  // Observable getters
  get currentUser(): Observable<any | null> {
    return this.currentUser$.asObservable();
  }

  get userProfile(): Observable<UserProfile | null> {
    return this.userProfile$.asObservable();
  }

  get isAuthenticated(): Observable<boolean> {
    return this.isAuthenticated$.asObservable();
  }

  get isAuthResolved(): Observable<boolean> {
    return this.authResolved$.asObservable();
  }

  get currentUserValue(): any | null {
    return this.currentUser$.value;
  }

  get currentUserProfileValue(): UserProfile | null {
    return this.userProfile$.value;
  }

  get isAuthenticatedValue(): boolean {
    return this.isAuthenticated$.value;
  }

  /** True when the current Firebase user has clicked the verification link. */
  get isEmailVerified(): boolean {
    return this.currentUser$.value?.emailVerified ?? false;
  }

  /** Re-sends the Firebase verification email (free, no Cloud Function). */
  async resendVerificationEmail(): Promise<void> {
    const firebaseUser = await this.afAuth.currentUser;
    if (firebaseUser) {
      await firebaseUser.reload();
      if (!firebaseUser.emailVerified) {
        await firebaseUser.sendEmailVerification();
      }
    }
  }

  /** Reload the Firebase user to pick up a newly-verified email flag. */
  async reloadUser(): Promise<boolean> {
    const firebaseUser = await this.afAuth.currentUser;
    if (firebaseUser) {
      await firebaseUser.reload();
      // After reload, get fresh reference from Firebase Auth
      const refreshed = await this.afAuth.currentUser;
      if (refreshed) {
        this.currentUser$.next(refreshed);
        return refreshed.emailVerified;
      }
    }
    return false;
  }
}
