import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AuthService, UserProfile } from '../../core/auth/auth.service';
import { FirestoreService } from '../../core/firestore/firestore.service';
import { StudentService, Student } from '../../core/firestore/student.service';
import { Transaction } from '../../core/firestore/fee.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';

type TxnTypeFilter = 'all' | 'fee_paid' | 'fee_waived';

@Component({
  selector: 'app-transactions',
  templateUrl: './transactions.page.html',
  styleUrls: ['./transactions.page.scss']
})
export class TransactionsPage implements OnInit, OnDestroy {
  libraryName = '';
  userEmail = '';

  isLoading = false;
  searchTerm = '';
  typeFilter: TxnTypeFilter = 'all';
  monthFilter = ''; // YYYY-MM

  allTxns: Transaction[] = [];
  filteredTxns: Transaction[] = [];

  private txnsSub?: Subscription;
  private profileSub?: Subscription;

  private studentByKey = new Map<string, Student>();

  constructor(
    private authService: AuthService,
    private firestoreService: FirestoreService,
    private studentService: StudentService,
    private alertController: AlertController,
    private toastController: ToastController,
    private firestore: AngularFirestore
  ) {}

  ngOnInit() {
    this.profileSub = this.authService.userProfile.subscribe((profile: UserProfile | null) => {
      if (!profile) return;
      this.libraryName = profile.libraryName || '';
      this.userEmail = profile.email || '';
    });

    // Spark optimization: subscribe to latest N transactions only.
    this.txnsSub = this.firestoreService
      .getCollectionObservable<Transaction>('transactions', [
        { type: 'orderBy', field: 'createdAt', direction: 'desc' },
        { type: 'limit', limit: 500 }
      ])
      .subscribe((txns) => {
        this.allTxns = (txns || []).map((t) => ({
          ...t,
          amount: Number((t as any).amount || 0)
        }));
        this.applyFilters();
      });

    void this.loadStudentsIndex();
  }

  ngOnDestroy() {
    this.txnsSub?.unsubscribe();
    this.profileSub?.unsubscribe();
  }

  async ionViewWillEnter() {
    await this.loadStudentsIndex();
    this.applyFilters();
  }

  private normalizeKey(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private async loadStudentsIndex() {
    this.isLoading = true;
    try {
      const students = await this.studentService.getAllStudents(10000);
      this.studentByKey.clear();
      students.forEach((s) => {
        if (s.studentId) this.studentByKey.set(this.normalizeKey(s.studentId), s);
        if (s.id) this.studentByKey.set(this.normalizeKey(s.id), s);
      });
    } finally {
      this.isLoading = false;
    }
  }

  onSearchChange() {
    this.applyFilters();
  }

  onMonthChange(value: string) {
    this.monthFilter = String(value || '').trim();
    this.applyFilters();
  }

  onFilterChange(value: unknown) {
    const v = String(value || '').trim();
    this.typeFilter = v === 'fee_paid' || v === 'fee_waived' ? (v as any) : 'all';
    this.applyFilters();
  }

  private applyFilters() {
    const term = this.searchTerm.trim().toLowerCase();
    const type = this.typeFilter;
    const month = this.monthFilter.trim().toLowerCase();

    this.filteredTxns = (this.allTxns || [])
      .filter((t) => (type === 'all' ? true : t.type === type))
      .filter((t) => (!month ? true : String(t.month || '').toLowerCase() === month))
      .filter((t) => {
        if (!term) return true;
        const studentName = this.resolveStudentName(t);
        const receipt = String(t.receiptNumber || '').toLowerCase();
        const studentId = String(t.studentId || '').toLowerCase();
        const month = String(t.month || '').toLowerCase();
        return (
          studentName.toLowerCase().includes(term) ||
          receipt.includes(term) ||
          studentId.includes(term) ||
          month.includes(term)
        );
      });
  }

  resolveStudentName(t: Transaction): string {
    if (t.studentName) return t.studentName;
    const s = this.studentByKey.get(this.normalizeKey(t.studentId));
    return s?.name || 'Unknown Student';
  }

  formatType(t: Transaction): string {
    return t.type === 'fee_paid' ? 'Paid' : 'Waived';
  }

  typeColor(t: Transaction): string {
    return t.type === 'fee_paid' ? 'success' : 'warning';
  }

  private buildReceiptText(t: Transaction): string {
    const createdAt = (t as any).createdAt;
    const when = createdAt ? new Date(createdAt as any).toLocaleString('en-IN') : '';
    return [
      `Receipt: ${t.receiptNumber || '—'}`,
      when ? `Date: ${when}` : '',
      `Student: ${this.resolveStudentName(t)} (${t.studentId})`,
      `Type: ${this.formatType(t)}`,
      `Month: ${t.month || '—'}`,
      `Amount: ₹${Number(t.amount || 0).toLocaleString('en-IN')}`,
      `By: ${t.actorEmail || '—'}`,
      `Note: ${t.note || '—'}`
    ]
      .filter(Boolean)
      .join('\n');
  }

  async exportCsv() {
    const rows = (this.filteredTxns || []).map((t) => ({
      receiptNumber: t.receiptNumber || '',
      type: t.type,
      month: t.month || '',
      amount: Number(t.amount || 0),
      studentId: t.studentId || '',
      studentName: this.resolveStudentName(t),
      actorEmail: t.actorEmail || '',
      note: t.note || ''
    }));

    const header = Object.keys(rows[0] || {
      receiptNumber: '',
      type: '',
      month: '',
      amount: 0,
      studentId: '',
      studentName: '',
      actorEmail: '',
      note: ''
    });

    const escapeCsv = (v: any) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const csv = [
      header.join(','),
      ...rows.map((r) => header.map((k) => escapeCsv((r as any)[k])).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const suffix = `${this.typeFilter}${this.monthFilter ? `-${this.monthFilter}` : ''}`;
    a.download = `receipts-${suffix || 'all'}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    await this.toast('CSV exported.');
  }

  async exportAllCsv() {
    const profile = this.authService.currentUserProfileValue;
    const libraryId = profile?.libraryId;
    if (!libraryId) {
      await this.toast('Library not loaded.', 'danger');
      return;
    }

    const type = this.typeFilter;
    const month = this.monthFilter.trim();

    const header = ['receiptNumber', 'type', 'month', 'amount', 'studentId', 'studentName', 'actorEmail', 'note'];
    const escapeCsv = (v: any) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const rows: string[] = [header.join(',')];

    this.isLoading = true;
    try {
      let lastCreatedAt: any = null;
      for (;;) {
        let query = this.firestore
          .collection(`libraries/${libraryId}/transactions`, (ref) => {
            let q: any = ref.orderBy('createdAt', 'desc').limit(500);
            if (lastCreatedAt) q = q.startAfter(lastCreatedAt);
            return q;
          })
          .get();

        const snap = await query.toPromise();
        const docs = snap?.docs || [];
        if (!docs.length) break;

        for (const d of docs) {
          const t = { id: d.id, ...(d.data() as any) } as Transaction;
          if (type !== 'all' && t.type !== type) continue;
          if (month && String(t.month || '') !== month) continue;

          const line = [
            t.receiptNumber || '',
            t.type || '',
            t.month || '',
            Number(t.amount || 0),
            t.studentId || '',
            t.studentName || '',
            t.actorEmail || '',
            t.note || ''
          ].map(escapeCsv);
          rows.push(line.join(','));
        }

        lastCreatedAt = docs[docs.length - 1]?.get('createdAt');
        if (!lastCreatedAt) break;
        if (docs.length < 500) break;
      }

      const csv = rows.join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = `${this.typeFilter}${this.monthFilter ? `-${this.monthFilter}` : ''}`;
      a.download = `receipts-ALL-${suffix || 'all'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      await this.toast('All CSV exported.');
    } catch (e) {
      console.error('exportAllCsv error', e);
      await this.toast('Export failed. Try again.', 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  // Receipt details now live in /transactions/:id

  getTotalAmount(): number {
    return (this.filteredTxns || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
  }

  getTodayCount(): number {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    return (this.filteredTxns || []).filter((t: any) => {
      const createdAt = t?.createdAt ? new Date(t.createdAt as any) : null;
      return createdAt && createdAt.getFullYear() === y && createdAt.getMonth() === m && createdAt.getDate() === d;
    }).length;
  }

  getThisMonthCount(): number {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    return (this.filteredTxns || []).filter((t) => String(t.month || '') === key).length;
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

