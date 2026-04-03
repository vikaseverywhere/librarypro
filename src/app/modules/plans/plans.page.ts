import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { PlanService, Plan } from '../../core/firestore/plan.service';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-plans',
  templateUrl: './plans.page.html',
  styleUrls: ['./plans.page.scss']
})
export class PlansPage implements OnInit {
  plans: Plan[] = [];
  isLoading = false;
  libraryName = '';

  // Form state
  showForm = false;
  isEditing = false;
  editingPlanId = '';
  isSaving = false;

  formData = {
    name: '',
    duration: 'monthly' as Plan['duration'],
    shift: '',
    shiftType: 'full' as Plan['shiftType'],
    amount: 0
  };

  durations: Array<{ value: Plan['duration']; label: string }> = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly (3 months)' },
    { value: 'half-yearly', label: 'Half-Yearly (6 months)' },
    { value: 'yearly', label: 'Yearly (12 months)' }
  ];

  shiftTypes: Array<{ value: Plan['shiftType']; label: string }> = [
    { value: 'full', label: 'Full Shift' },
    { value: 'half', label: 'Half Shift' }
  ];

  constructor(
    private planService: PlanService,
    private authService: AuthService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.authService.userProfile.subscribe(profile => {
      if (profile) this.libraryName = profile.libraryName || '';
    });
    this.loadPlans();
  }

  async ionViewWillEnter() {
    await this.loadPlans();
  }

  async loadPlans() {
    this.isLoading = true;
    try {
      this.plans = await this.planService.getActivePlans();
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      this.isLoading = false;
    }
  }

  openAddForm() {
    this.showForm = true;
    this.isEditing = false;
    this.editingPlanId = '';
    this.formData = {
      name: '',
      duration: 'monthly',
      shift: '',
      shiftType: 'full',
      amount: 0
    };
  }

  openEditForm(plan: Plan) {
    this.showForm = true;
    this.isEditing = true;
    this.editingPlanId = plan.id || '';
    this.formData = {
      name: plan.name,
      duration: plan.duration,
      shift: plan.shift,
      shiftType: plan.shiftType,
      amount: plan.amount
    };
  }

  closeForm() {
    this.showForm = false;
    this.isEditing = false;
    this.editingPlanId = '';
  }

  isFormValid(): boolean {
    return !!(
      this.formData.name.trim() &&
      this.formData.shift.trim() &&
      this.formData.duration &&
      this.formData.shiftType &&
      this.formData.amount > 0
    );
  }

  async onSave() {
    if (!this.isFormValid()) {
      await this.toast('Please fill all fields correctly.', 'danger');
      return;
    }

    this.isSaving = true;
    try {
      if (this.isEditing && this.editingPlanId) {
        await this.planService.updatePlan(this.editingPlanId, {
          name: this.formData.name.trim(),
          duration: this.formData.duration,
          shift: this.formData.shift.trim(),
          shiftType: this.formData.shiftType,
          amount: Number(this.formData.amount)
        });
        await this.toast('Plan updated successfully.', 'success');
      } else {
        await this.planService.createPlan({
          name: this.formData.name.trim(),
          duration: this.formData.duration,
          shift: this.formData.shift.trim(),
          shiftType: this.formData.shiftType,
          amount: Number(this.formData.amount),
          isActive: true
        });
        await this.toast('Plan created successfully.', 'success');
      }
      this.closeForm();
      await this.loadPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      await this.toast('Failed to save plan. Please try again.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async onDelete(plan: Plan) {
    const alert = await this.alertController.create({
      header: 'Delete Plan',
      message: `Are you sure you want to delete "${plan.name}"? Students already on this plan won't be affected.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.planService.deletePlan(plan.id!);
              await this.toast('Plan deleted.', 'success');
              await this.loadPlans();
            } catch (error) {
              await this.toast('Failed to delete plan.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  getDurationLabel(duration: string): string {
    const match = this.durations.find(d => d.value === duration);
    return match ? match.label : duration;
  }

  getShiftTypeLabel(shiftType: string): string {
    return shiftType === 'full' ? 'Full Shift' : 'Half Shift';
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
}
