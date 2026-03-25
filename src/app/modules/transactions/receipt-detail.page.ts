import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { FirestoreService } from '../../core/firestore/firestore.service';
import { Transaction } from '../../core/firestore/fee.service';

@Component({
  selector: 'app-receipt-detail',
  templateUrl: './receipt-detail.page.html',
  styleUrls: ['./receipt-detail.page.scss']
})
export class ReceiptDetailPage implements OnInit {
  txnId = '';
  txn: Transaction | null = null;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private navController: NavController,
    private firestoreService: FirestoreService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    this.txnId = String(this.route.snapshot.paramMap.get('id') || '').trim();
    await this.load();
  }

  async load() {
    this.isLoading = true;
    try {
      if (!this.txnId) {
        this.txn = null;
        return;
      }
      this.txn = await this.firestoreService.read<Transaction>('transactions', this.txnId);
    } finally {
      this.isLoading = false;
    }
  }

  get qrUrl(): string {
    const data = encodeURIComponent(this.txn?.receiptNumber || this.txnId || '');
    // Lightweight QR image (no npm deps). If offline, QR won’t load — receipt still visible.
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${data}`;
  }

  async copyReceipt() {
    const value = String(this.txn?.receiptNumber || '');
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      await this.toast('Receipt number copied.');
    } catch {
      await this.toast('Could not copy receipt.', 'danger');
    }
  }

  async shareReceipt() {
    const text = [
      `Receipt: ${this.txn?.receiptNumber || '—'}`,
      `Student: ${this.txn?.studentName || '—'} (${this.txn?.studentId || '—'})`,
      `Type: ${this.txn?.type || '—'}`,
      `Month: ${this.txn?.month || '—'}`,
      `Amount: ₹${Number(this.txn?.amount || 0).toLocaleString('en-IN')}`
    ].join('\n');

    try {
      if ((navigator as any).share) {
        await (navigator as any).share({
          title: this.txn?.receiptNumber || 'Receipt',
          text
        });
        return;
      }
      await navigator.clipboard.writeText(text);
      await this.toast('Receipt copied (share not available).');
    } catch {
      await this.toast('Could not share/copy receipt.', 'danger');
    }
  }

  goBack() {
    this.navController.navigateBack('/transactions');
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success') {
    const t = await this.toastController.create({
      message,
      duration: 2200,
      color,
      position: 'bottom'
    });
    await t.present();
  }
}

