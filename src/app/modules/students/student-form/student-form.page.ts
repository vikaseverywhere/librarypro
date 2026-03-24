import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StudentService } from '../../../core/firestore/student.service';

@Component({
  selector: 'app-student-form',
  templateUrl: './student-form.page.html',
  styleUrls: ['./student-form.page.scss']
})
export class StudentFormPage implements OnInit {
  isEditMode = false;
  studentId = '';
  isLoading = false;
  isSaving = false;
  errorMessage = '';

  formData = {
    name: '',
    email: '',
    phone: '',
    seatNumber: ''
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private studentService: StudentService
  ) {
    console.log('StudentFormPage constructor called');
  }

  async ngOnInit() {
    console.log('StudentFormPage ngOnInit called');
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.studentId = id;
      await this.loadStudent();
    }
  }

  async loadStudent() {
    this.isLoading = true;
    try {
      const student = await this.studentService.getStudent(this.studentId);
      if (!student) {
        this.errorMessage = 'Student not found';
        return;
      }

      this.formData = {
        name: student.name || '',
        email: student.email || '',
        phone: student.phone || '',
        seatNumber: student.seatNumber ? String(student.seatNumber) : ''
      };
    } catch (error) {
      console.error('Error loading student:', error);
      this.errorMessage = 'Failed to load student details';
    } finally {
      this.isLoading = false;
    }
  }

  ionViewWillLoad() {
    console.log('StudentFormPage ionViewWillLoad');
  }

  ionViewDidLoad() {
    console.log('StudentFormPage ionViewDidLoad');
  }

  ionViewWillEnter() {
    console.log('StudentFormPage ionViewWillEnter');
  }

  ionViewDidEnter() {
    console.log('StudentFormPage ionViewDidEnter');
  }

  isFormValid(): boolean {
    const seat = Number(this.formData.seatNumber);
    return !!(this.formData.name && this.formData.email && this.formData.phone && seat >= 1);
  }

  async onSave() {
    console.log('onSave called', this.formData);
    if (!this.isFormValid()) {
      alert('Please fill all fields');
      return;
    }
    
    const seatNumber = Number(this.formData.seatNumber);
    if (!Number.isInteger(seatNumber) || seatNumber < 1) {
      this.errorMessage = 'Please enter a valid seat number.';
      return;
    }

    this.errorMessage = '';
    this.isSaving = true;
    try {
      if (this.isEditMode && this.studentId) {
        await this.studentService.updateStudent(this.studentId, {
          name: this.formData.name,
          email: this.formData.email,
          phone: this.formData.phone,
          seatNumber
        });
      } else {
        await this.studentService.addStudent({
          name: this.formData.name,
          email: this.formData.email,
          phone: this.formData.phone,
          seatNumber,
          enrollmentDate: new Date(),
          totalFeePending: 0,
          seatStatus: 'occupied'
        });
      }
      console.log('Student saved, navigating back');
      this.router.navigate(['/students']);
    } catch (error: any) {
      console.error('Error saving student:', error);
      this.errorMessage = error?.message || 'Failed to save student';
    } finally {
      this.isSaving = false;
    }
  }

  goBack() {
    console.log('goBack called');
    this.router.navigate(['/students']);
  }
}
