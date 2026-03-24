import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { BehaviorSubject, Observable } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private libraryId$ = new BehaviorSubject<string>('');

  constructor(
    private firestore: AngularFirestore,
    private authService: AuthService
  ) {
    this.authService.userProfile.subscribe(profile => {
      if (profile) {
        this.libraryId$.next(profile.libraryId);
      }
    });
  }

  private get libraryId(): string {
    return this.libraryId$.value;
  }

  private async ensureLibraryId(): Promise<string> {
    if (this.libraryId) {
      return this.libraryId;
    }

    const id = await firstValueFrom(
      this.libraryId$.pipe(
        filter((value) => !!value),
        take(1)
      )
    );

    if (!id) {
      throw new Error('Library context unavailable. Please login again.');
    }

    return id;
  }

  // Generic CRUD operations
  async create<T>(collectionName: string, data: T, docId?: string): Promise<string> {
    try {
      const libraryId = await this.ensureLibraryId();
      const collectionRef = this.firestore.collection(`libraries/${libraryId}/${collectionName}`);
      let docRef;
      if (docId) {
        docRef = collectionRef.doc(docId);
        await docRef.set({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        return docRef.ref.id;
      } else {
        const result = await collectionRef.add({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        return result.id;
      }
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  }

  async read<T>(collectionName: string, docId: string): Promise<T | null> {
    try {
      const libraryId = await this.ensureLibraryId();
      const docSnap = await this.firestore.collection(`libraries/${libraryId}/${collectionName}`).doc(docId).get().toPromise();
      if (docSnap && docSnap.exists) {
        const data = docSnap.data();
        return { id: docSnap.id, ...(data as object) } as T;
      }
      return null;
    } catch (error) {
      console.error('Error reading document:', error);
      throw error;
    }
  }

  async update<T>(collectionName: string, docId: string, data: Partial<T>): Promise<void> {
    try {
      const libraryId = await this.ensureLibraryId();
      const docRef = this.firestore.collection(`libraries/${libraryId}/${collectionName}`).doc(docId);
      await docRef.update({
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating document:', error);
      throw error;
    }
  }

  async delete(collectionName: string, docId: string): Promise<void> {
    try {
      const libraryId = await this.ensureLibraryId();
      const docRef = this.firestore.collection(`libraries/${libraryId}/${collectionName}`).doc(docId);
      await docRef.delete();
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  }

  async list<T>(
    collectionName: string,
    constraints: any[] = []
  ): Promise<T[]> {
    try {
      const libraryId = await this.ensureLibraryId();
      let query: any = this.firestore.collection(`libraries/${libraryId}/${collectionName}`);

      constraints.forEach(constraint => {
        if (constraint.type === 'where') {
          query = query.where(constraint.field, constraint.operator, constraint.value);
        } else if (constraint.type === 'orderBy') {
          query = query.orderBy(constraint.field, constraint.direction);
        } else if (constraint.type === 'limit') {
          query = query.limit(constraint.limit);
        }
      });

      const querySnapshot = await query.get().toPromise();
      return querySnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (error) {
      console.error('Error listing documents:', error);
      throw error;
    }
  }

  async search<T>(
    collectionName: string,
    field: string,
    value: any
  ): Promise<T[]> {
    try {
      const libraryId = await this.ensureLibraryId();
      const querySnapshot = await this.firestore
        .collection(`libraries/${libraryId}/${collectionName}`)
        .ref
        .where(field, '>=', value)
        .where(field, '<=', value + '\uf8ff')
        .get();

      return querySnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  // Library methods
  async getLibraryData(libraryId: string) {
    try {
      const docSnap = await this.firestore.collection('libraries').doc(libraryId).get().toPromise();
      if (docSnap && docSnap.exists) {
        const data = docSnap.data();
        return { id: docSnap.id, ...(data as object) };
      }
      return null;
    } catch (error) {
      console.error('Error getting library data:', error);
      throw error;
    }
  }

  async getCurrentLibraryData() {
    const libraryId = await this.ensureLibraryId();
    return this.getLibraryData(libraryId);
  }

  async updateLibrary(libraryId: string, data: any): Promise<void> {
    try {
      const docRef = this.firestore.collection('libraries').doc(libraryId);
      // Use set+merge so it works even if some fields don't exist yet on older documents
      await docRef.set({ ...data, updatedAt: new Date() }, { merge: true });
    } catch (error) {
      console.error('Error updating library:', error);
      throw error;
    }
  }

  // Observable methods for real-time data
  getCollectionObservable<T>(collectionName: string, constraints: any[] = []): Observable<T[]> {
    let query: any = this.firestore.collection(`libraries/${this.libraryId}/${collectionName}`);

    constraints.forEach(constraint => {
      if (constraint.type === 'where') {
        query = query.where(constraint.field, constraint.operator, constraint.value);
      } else if (constraint.type === 'orderBy') {
        query = query.orderBy(constraint.field, constraint.direction);
      } else if (constraint.type === 'limit') {
        query = query.limit(constraint.limit);
      }
    });

    return new Observable<T[]>(observer => {
      const unsubscribe = query.onSnapshot(
        (snapshot: any) => {
          const data = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data()
          })) as T[];
          observer.next(data);
        },
        (error: any) => {
          observer.error(error);
        }
      );

      return unsubscribe;
    });
  }

  getDocumentObservable<T>(collectionName: string, docId: string): Observable<T | null> {
    return new Observable<T | null>(observer => {
      const docRef = this.firestore.collection(`libraries/${this.libraryId}/${collectionName}`).doc(docId);
      const unsubscribe = docRef.valueChanges().subscribe(
        (data: any) => {
          if (data) {
            observer.next({ id: docId, ...data } as T);
          } else {
            observer.next(null);
          }
        },
        (error: any) => {
          observer.error(error);
        }
      );

      return unsubscribe;
    });
  }
}
