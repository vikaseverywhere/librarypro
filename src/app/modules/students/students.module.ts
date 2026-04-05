import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { StudentsPage } from './students.page';
import { StudentFormPage } from './student-form/student-form.page';
import { StudentProfilePage } from './student-profile/student-profile.page';

const routes: Routes = [
  { path: '',             component: StudentsPage },
  { path: 'add',          component: StudentFormPage },
  { path: 'edit/:id',     component: StudentFormPage },
  { path: 'profile/:id',  component: StudentProfilePage }
];

@NgModule({
  declarations: [StudentsPage, StudentFormPage, StudentProfilePage],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class StudentsModule {}
