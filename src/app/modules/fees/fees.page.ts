import { Component, OnInit } from '@angular/core';
import { NavController, AlertController } from '@ionic/angular';
import { FeeService, Fee } from '../../core/firestore/fee.service';
import { StudentService, Student } from '../../core/firestore/student.service';

interface PendingFee extends Fee {
  studentName: string;
  studentId: string;
}

@Component({
  selector: 'app-fees',
  templateUrl: './fees.page.html',
  styleUrls: ['./fees.page.scss']
})
export class FeesPage implements OnInit {
  pendingFees: PendingFee[] = [];
  feeStats = {
    totalPending: 0,
    totalOverdue: 0,
    totalPaid: 0,
    monthlyRevenue: 0
  };
  isLoading = false;

  constructor(
    private navController: NavController,
    private feeService: FeeService,
    private studentService: StudentService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadFees();
  }

  async ionViewWillEnter() {
    await this.loadFees();
  }

  async loadFees() {
    this.isLoading = true;
    try {
      this.feeStats = await this.feeService.getFeeStats();

      const [pendingFees, overdueFees] = await Promise.all([
        this.feeService.getFeesByStatus('pending'),
        this.feeService.getFeesByStatus('overdue')
      ]);

      const allPendingFees = [...pendingFees, ...overdueFees];

      const studentIds = [...new Set(allPendingFees.map(f => f.studentId))];
      const students: Student[] = [];

      for (const studentId of studentIds) {
        const student = await this.studentService.getStudent(studentId);
        if (student) students.push(student);
      }

      this.pendingFees = allPendingFees.map(fee => {
        const student = students.find(s => s.studentId === fee.studentId);
        return {
          ...fee,
          studentName: student ? student.name : 'Unknown Student',
          studentId: fee.studentId
        };
      });
    } catch (error) {
      console.error('Error loading fees:', error);
    } finally {
      this.isLoading = false;
    }
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  onAddFee() {
    this.navController.navigateForward('/fees/collect');
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
            if (!fee.feeId) return;
            await this.feeService.markAsPaid(fee.feeId, 'cash');
            await this.loadFees();
          }
        }
      ]
    });
    await alert.present();
  }

  async onViewAllPaid() {
    const paidFees = await this.feeService.getFeesByStatus('paid');
    const total = paidFees.reduce((sum, f) => sum + f.amount, 0);
    const alert = await this.alertController.create({
      header: 'Paid Fees',
      message: `Total ${paidFees.length} paid records.\nTotal collected: ₹${total.toLocaleString('en-IN')}`,
      buttons: ['OK']
    });
    await alert.present();
  }

  async onSendReminder(fee: PendingFee) {
    const alert = await this.alertController.create({
      header: 'Reminder Ready',
      message: `Reminder prepared for ${fee.studentName}. You can integrate SMS/Email next.`,
      buttons: ['OK']
    });
    await alert.present();
  }

  goBack() {
    this.navController.navigateBack('/dashboard');
  }
}
