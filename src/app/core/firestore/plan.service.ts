import { Injectable } from '@angular/core';
import { FirestoreService } from './firestore.service';

export interface Plan {
  id?: string;
  name: string;
  duration: 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
  shift: string;        // e.g. "Shift 1", "Morning Shift", custom name
  shiftType: 'full' | 'half';
  amount: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const COLLECTION = 'plans';

@Injectable({
  providedIn: 'root'
})
export class PlanService {
  constructor(private firestoreService: FirestoreService) {}

  async createPlan(plan: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return this.firestoreService.create<Omit<Plan, 'id'>>(COLLECTION, {
      ...plan,
      isActive: true
    });
  }

  async updatePlan(planId: string, data: Partial<Plan>): Promise<void> {
    return this.firestoreService.update(COLLECTION, planId, data);
  }

  async deletePlan(planId: string): Promise<void> {
    return this.firestoreService.update(COLLECTION, planId, { isActive: false });
  }

  async getActivePlans(): Promise<Plan[]> {
    const plans = await this.firestoreService.list<Plan>(COLLECTION, [
      { type: 'where', field: 'isActive', operator: '==', value: true }
    ]);
    return plans.sort((a, b) => {
      const ta = (a.createdAt as any)?.seconds || 0;
      const tb = (b.createdAt as any)?.seconds || 0;
      return ta - tb;
    });
  }

  async getAllPlans(): Promise<Plan[]> {
    const plans = await this.firestoreService.list<Plan>(COLLECTION);
    return plans.sort((a, b) => {
      const ta = (a.createdAt as any)?.seconds || 0;
      const tb = (b.createdAt as any)?.seconds || 0;
      return ta - tb;
    });
  }

  async getPlan(planId: string): Promise<Plan | null> {
    return this.firestoreService.read<Plan>(COLLECTION, planId);
  }
}
