import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { AuthService, UserProfile } from '../auth/auth.service';

export interface Library {
  id?: string; // Firestore doc id
  libraryId: string;
  name: string;
  city?: string;
  totalSeats?: number;
  seatCount?: number;
  monthlyFee?: number;
  // Dynamic shift configuration (per library).
  // Example: [{ id: 's1', name: 'Morning', monthlyFee: 1500 }]
  shifts?: Array<{ id: string; name: string; monthlyFee: number }>;
  photoUrl?: string;
  ownerEmail?: string;
  ownerUid?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateLibraryInput {
  name: string;
  city: string;
  totalSeats: number;
  // kept for backward compatibility; when shifts provided, student fee can be calculated by shifts.
  monthlyFee: number;
  shifts?: Array<{ id: string; name: string; monthlyFee: number }>;
  photoUrl?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LibraryService {
  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService
  ) {}

  private async getCurrentProfile(): Promise<UserProfile> {
    const existing = this.authService.currentUserProfileValue;
    if (existing) return existing;

    return firstValueFrom(
      this.authService.userProfile.pipe(
        filter((p): p is UserProfile => !!p),
        take(1)
      )
    );
  }

  private getOwnedLibraryIds(profile: UserProfile): string[] {
    if (profile.libraryIds?.length) return profile.libraryIds;
    return profile.libraryId ? [profile.libraryId] : [];
  }

  async listOwnedLibraries(): Promise<Library[]> {
    const profile = await this.getCurrentProfile();
    const ids = this.getOwnedLibraryIds(profile);

    const libraries = await Promise.all(
      ids.map(async (id) => {
        const snap = await this.firestore.collection('libraries').doc(id).get().toPromise();
        if (!snap?.exists) return null;
        const data = snap.data() as Omit<Library, 'id'>;
        return { id: snap.id, ...(data || {}) } as Library;
      })
    );

    return libraries.filter((v): v is Library => !!v);
  }

  async createLibrary(input: CreateLibraryInput): Promise<string> {
    const profile = await this.getCurrentProfile();

    const libraryId = `lib_${Date.now()}_${profile.uid.substring(0, 8)}`;
    const now = new Date();

    // Update user doc first so security rules allow writing libraries/{newId}.
    const existingIds = this.getOwnedLibraryIds(profile);
    const newIds = Array.from(new Set([...existingIds, libraryId]));

    await this.authService.updateCurrentUserProfile({
      // Add membership first (security rules need this) but keep the current
      // active library unchanged until the new library document is created.
      libraryIds: newIds
    });

    // Now that user belongs to the new libraryId, create the library document.
    await this.firestore.collection('libraries').doc(libraryId).set({
      libraryId,
      name: input.name,
      ownerUid: profile.uid,
      ownerEmail: profile.email,
      city: input.city,
      country: 'IN',
      subscriptionPlan: 'free',
      subscriptionStatus: 'active',
      subscriptionStartDate: now,
      subscriptionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subscriptionAmount: 0,
      totalSeats: input.totalSeats,
      seatCount: input.totalSeats,
      monthlyFee: input.monthlyFee,
      shifts: input.shifts || [],
      photoUrl: input.photoUrl || '',
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      createdAt: now,
      updatedAt: now,
      createdBy: profile.email
    });

    // Finally, switch active library context.
    await this.authService.updateCurrentUserProfile({
      libraryId,
      libraryName: input.name,
      city: input.city
    });

    return libraryId;
  }

  async setActiveLibrary(libraryId: string): Promise<void> {
    const snap = await this.firestore.collection('libraries').doc(libraryId).get().toPromise();
    if (!snap?.exists) {
      throw new Error('Library not found.');
    }

    const data = snap.data() as Partial<Library>;
    const name = data?.name;
    const city = data?.city;

    if (!name) {
      throw new Error('Library name missing in Firestore document.');
    }

    await this.authService.updateCurrentUserProfile({
      libraryId,
      libraryName: name,
      city: city ?? this.authService.currentUserProfileValue?.city
    });
  }
}

