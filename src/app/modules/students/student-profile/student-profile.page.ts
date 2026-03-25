import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController } from '@ionic/angular';
import { StudentService, Student } from '../../../core/firestore/student.service';
import { FeeService, Fee, Transaction } from '../../../core/firestore/fee.service';
import { FirestoreService } from '../../../core/firestore/firestore.service';

@Component({
  selector: 'app-student-profile',
  templateUrl: './student-profile.page.html',
  styleUrls: ['./student-profile.page.scss']
})
export class StudentProfilePage implements OnInit {
  studentId = '';
  student: Student | null = null;
  fees: Fee[] = [];
  receipts: Transaction[] = [];
  isLoading = false;

  constructor(
    private route: ActivatedRoute,
    private navController: NavController,
    private studentService: StudentService,
    private feeService: FeeService,
    private firestoreService: FirestoreService
  ) {}

  async ngOnInit() {
    this.studentId = String(this.route.snapshot.paramMap.get('id') || '').trim();
    await this.load();
  }

  async ionViewWillEnter() {
    await this.load();
  }

  async load() {
    this.isLoading = true;
    try {
      this.student = await this.studentService.getStudent(this.studentId);
      this.fees = await this.feeService.getFeesByStudent(this.studentId);
      const txns = await this.firestoreService.list<Transaction>('transactions', [
        { type: 'where', field: 'studentId', operator: '==', value: this.studentId },
        { type: 'orderBy', field: 'createdAt', direction: 'desc' },
        { type: 'limit', limit: 200 }
      ]);
      this.receipts = txns || [];
    } catch (e) {
      console.error('student profile load failed', e);
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

  goBack() {
    this.navController.navigateBack('/students');
  }
}

