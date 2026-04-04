import { Component, OnInit, OnDestroy } from '@angular/core';
import { NavController, AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { FeeService, Fee } from '../../core/firestore/fee.service';
import { StudentService, Student } from '../../core/firestore/student.service';
import { AuthService, UserProfile } from '../../core/auth/auth.service';

interface PendingFee extends Fee {
  studentName: string;
  studentId: string;
}

@Component({
  selector: 'app-fees',
  templateUrl: './fees.page.html',
  styleUrls: ['./fees.page.scss']
})
export class FeesPage implements OnInit, OnDestroy {
  pendingFees: PendingFee[] = [];
  feeStats = {
    totalPending: 0,
    totalOverdue: 0,
    totalPaid: 0,
    monthlyRevenue: 0
  };
  isLoading = false;
  libraryName = '';
  userEmail = '';
  private profileSub?: Subscription;

  constructor(
    private navController: NavController,
    private feeService: FeeService,
    private studentService: StudentService,
    private alertController: AlertController,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.profileSub = this.authService.userProfile.subscribe((profile: UserProfile | null) => {
      if (!profile) return;
      this.libraryName = profile.libraryName || '';
      this.userEmail = profile.email || '';
    });
  }

  ngOnDestroy() {
    this.profileSub?.unsubscribe();
  }

  async ionViewWillEnter() {
    await this.loadFees();
  }

  async loadFees() {
    this.isLoading = true;
    try {
      this.feeStats = await this.feeService.getFeeStats();

      const [pendingFees, overdueFees, students] = await Promise.all([
        this.feeService.getFeesByStatus('pending'),
        this.feeService.getFeesByStatus('overdue'),
        this.studentService.getAllStudents(10000)
      ]);

      const allPendingFees = [...pendingFees, ...overdueFees];

      const studentByKey = new Map<string, Student>();
      students.forEach((student) => {
        if (student.studentId) {
          studentByKey.set(student.studentId.trim().toLowerCase(), student);
        }
        if (student.id) {
          studentByKey.set(student.id.trim().toLowerCase(), student);
        }
      });

      this.pendingFees = allPendingFees.map((fee) => {
        const rawStudentId = String(fee.studentId || '').trim();
        const student = studentByKey.get(rawStudentId.toLowerCase());
        const legacyName = (fee as any).studentName || (fee as any).studentFullName;
        return {
          ...fee,
          studentName: student ? student.name : (legacyName || 'Unknown Student'),
          studentId: rawStudentId
        };
      });

      // Backfill unresolved names for legacy rows by direct doc lookup (parallel).
      const unresolved = this.pendingFees.filter((fee) => fee.studentName === 'Unknown Student');
      await Promise.all(unresolved.map(async (fee) => {
        const docCandidates = [
          String((fee as any).studentDocId || '').trim(),
          String(fee.studentId || '').trim()
        ].filter(Boolean);

        for (const candidate of docCandidates) {
          const directStudent = await this.studentService.getStudent(candidate);
          if (directStudent?.name) {
            fee.studentName = directStudent.name;
            break;
          }
        }
      }));
    } catch (error) {
      console.error('Error loading fees:', error);
    } finally {
      this.isLoading = false;
    }
  }

  getInitials(name: string): string {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] || '';
    const second = parts[1]?.[0] || '';
    return (first + second).toUpperCase();
  }

  onAddFee() {
    this.navController.navigateForward('/tabs/fees/collect');
  }

  async onGenerateMonthlyFees() {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 7);

    const alert = await this.alertController.create({
      header: 'Generate Monthly Fees',
      message: 'This will create fee records for ALL active students (using each student’s shift-based monthly fee).',
      inputs: [
        { name: 'month', type: 'text', value: defaultMonth, placeholder: 'YYYY-MM' },
        { name: 'dueDate', type: 'date', value: defaultDue.toISOString().slice(0, 10) }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Generate',
          handler: async (data: any) => {
            try {
              const month = String(data?.month || '').trim();
              const dueDateStr = String(data?.dueDate || '').trim();
              if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('Month must be in YYYY-MM format.');
              if (!dueDateStr) throw new Error('Due date required.');

              const dueDate = new Date(dueDateStr);
              const students = await this.studentService.getAllStudents(10000);
              const eligible = students.filter((s: any) => Number(s.monthlyFee || 0) > 0);

              // Parallel existence checks, then batched creates
              const existsResults = await Promise.all(
                eligible.map((s: any) => this.feeService.feeExistsForStudentMonth(s.studentId, month))
              );
              const toCreate = eligible.filter((_: any, i: number) => !existsResults[i]);

              const BATCH = 10;
              for (let i = 0; i < toCreate.length; i += BATCH) {
                await Promise.all(
                  toCreate.slice(i, i + BATCH).map((s: any) =>
                    this.feeService.createFee({
                      studentId: s.studentId,
                      studentDocId: s.id || s.studentId,
                      studentName: s.name,
                      amount: Number(s.monthlyFee || 0),
                      month,
                      dueDate,
                      status: 'pending'
                    })
                  )
                );
              }

              await this.loadFees();
            } catch (e: any) {
              const err = await this.alertController.create({
                header: 'Bulk Generate Failed',
                message: e?.message || 'Could not generate fees.',
                buttons: ['OK']
              });
              await err.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async onWaiveFee(fee: PendingFee) {
    const feeDocId = fee.id || fee.feeId;
    if (!feeDocId) return;

    const alert = await this.alertController.create({
      header: 'Waive Fee',
      message: `Waive fee for ${fee.studentName} (₹${fee.amount})?`,
      inputs: [{ name: 'reason', type: 'text', placeholder: 'Reason (optional)' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Waive',
          role: 'destructive',
          handler: async (data: any) => {
            try {
              await this.feeService.waiveFee(feeDocId, String(data?.reason || '').trim());
              await this.loadFees();
            } catch (e: any) {
              const err = await this.alertController.create({
                header: 'Waive Failed',
                message: e?.message || 'Could not waive this fee.',
                buttons: ['OK']
              });
              await err.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async onMarkPaid(fee: PendingFee) {
    const alert = await this.alertController.create({
      header: 'Mark Fee As Paid',
      message: `Confirm payment for ${fee.studentName} (₹${fee.amount})?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: async () => {
            const feeDocId = fee.id || fee.feeId;
            if (!feeDocId) {
              const errAlert = await this.alertController.create({
                header: 'Cannot Mark Paid',
                message: 'Fee record ID missing. Please recreate this fee entry.',
                buttons: ['OK']
              });
              await errAlert.present();
              return;
            }

            try {
              await this.feeService.markAsPaid(feeDocId, 'cash');
              await this.loadFees();
            } catch (error: any) {
              const errAlert = await this.alertController.create({
                header: 'Payment Update Failed',
                message: error?.message || 'Could not mark this fee as paid. Please try again.',
                buttons: ['OK']
              });
              await errAlert.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async onViewAllPaid() {
    this.navController.navigateForward('/tabs/transactions');
  }

  goBack() {
    this.navController.navigateBack('/tabs/dashboard');
  }
}
