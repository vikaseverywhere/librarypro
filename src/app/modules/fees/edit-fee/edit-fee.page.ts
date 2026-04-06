import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { FeeService, Fee } from '../../../core/firestore/fee.service';

@Component({
  selector: 'app-edit-fee',
  templateUrl: './edit-fee.page.html',
  styleUrls: ['./edit-fee.page.scss']
})
export class EditFeePage implements OnInit {
  feeId = '';
  fee: Fee | null = null;
  isLoading = false;
  isSaving = false;
  amount = '';
  dueDate: string = '';

  constructor(
    private route: ActivatedRoute,
    private navController: NavController,
    private feeService: FeeService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.feeId = String(this.route.snapshot.paramMap.get('id') || '').trim();
    await this.loadFee();
  }

  async loadFee() {
    this.isLoading = true;
    try {
      this.fee = await this.feeService.getFee(this.feeId);
      if (this.fee) {
        this.amount = String(this.fee.amount || '');
        this.dueDate = this.toDateInput(this.fee.dueDate);
      }
    } catch (e) {
      await this.toast('Failed to load fee.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  toDateInput(date: any): string {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date.seconds ? date.seconds * 1000 : date);
    return d.toISOString().substring(0, 10);
  }

  async onSave() {
    if (!this.fee) return;
    const amount = Number(this.amount);
    if (isNaN(amount) || amount < 1) {
      await this.toast('Enter a valid amount.', 'danger');
      return;
    }
    if (!this.dueDate) {
      await this.toast('Select a due date.', 'danger');
      return;
    }
    this.isSaving = true;
    try {
      await this.feeService.updateFee(this.feeId, {
        amount,
        dueDate: new Date(this.dueDate)
      });
      await this.toast('Fee updated.', 'success');
      this.navController.back();
    } catch (e) {
      await this.toast('Failed to update fee.', 'danger');
    } finally {
      this.isSaving = false;
    }
  }

  async toast(message: string, color: 'success' | 'danger') {
    const t = await this.toastController.create({
      message,
      duration: 2200,
      color,
      position: 'bottom'
    });
    await t.present();
  }
}
