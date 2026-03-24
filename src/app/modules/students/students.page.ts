import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { StudentService, Student } from '../../core/firestore/student.service';

@Component({
  selector: 'app-students',
  templateUrl: './students.page.html',
  styleUrls: ['./students.page.scss']
})
export class StudentsPage implements OnInit {
  students: Student[] = [];
  filteredStudents: Student[] = [];
  isLoading = false;
  searchTerm = '';

  constructor(
    private router: Router,
    private studentService: StudentService,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadStudents();
  }

  async ionViewWillEnter() {
    await this.loadStudents();
  }

  async loadStudents() {
    this.isLoading = true;
    try {
      this.students = await this.studentService.getAllStudents();
      this.filteredStudents = [...this.students];
    } catch (error) {
      console.error('Error loading students:', error);
    } finally {
      this.isLoading = false;
    }
  }

  onSearchChange() {
    if (this.searchTerm.trim()) {
      this.filteredStudents = this.students.filter(student =>
        student.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        student.phone.includes(this.searchTerm) ||
        student.studentId.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        String(student.seatNumber || '').includes(this.searchTerm)
      );
    } else {
      this.filteredStudents = [...this.students];
    }
  }

  onAddStudent() {
    console.log('onAddStudent - navigating to /students/add');
    this.router.navigate(['/students/add']);
  }

  onEditStudent(student: Student) {
    console.log('onEditStudent - navigating to /students/edit/' + student.studentId);
    this.router.navigate(['/students/edit', student.studentId]);
  }

  async onDeleteStudent(student: Student) {
    const alert = await this.alertController.create({
      header: 'Delete Student',
      message: `Remove ${student.name} from this library?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            if (!student.studentId) return;
            await this.studentService.deleteStudent(student.studentId);
            await this.loadStudents();
          }
        }
      ]
    });
    await alert.present();
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
