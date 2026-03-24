import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouteReuseStrategy } from '@angular/router';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { AuthGuard } from './core/auth/auth.guard';

// Firebase
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';

import { environment } from '../environments/environment';

// Feature Pages
import { DashboardPage } from './modules/dashboard/dashboard.page';
import { StudentsPage } from './modules/students/students.page';
import { StudentFormPage } from './modules/students/student-form/student-form.page';
import { FeesPage } from './modules/fees/fees.page';
import { CollectFeePage } from './modules/fees/collect-fee/collect-fee.page';
import { SettingsPage } from './modules/settings/settings.page';

const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule) },
  { path: 'dashboard',         canActivate: [AuthGuard], component: DashboardPage },
  { path: 'students/add',      canActivate: [AuthGuard], component: StudentFormPage },
  { path: 'students/edit/:id', canActivate: [AuthGuard], component: StudentFormPage },
  { path: 'students',          canActivate: [AuthGuard], component: StudentsPage },
  { path: 'fees/collect',      canActivate: [AuthGuard], component: CollectFeePage },
  { path: 'fees',              canActivate: [AuthGuard], component: FeesPage },
  { path: 'settings',          canActivate: [AuthGuard], component: SettingsPage },
  { path: '',                  redirectTo: 'auth/login', pathMatch: 'full' },
  { path: '**',                redirectTo: 'auth/login' }
];

@NgModule({
  declarations: [
    AppComponent,
    DashboardPage,
    StudentsPage,
    StudentFormPage,
    FeesPage,
    CollectFeePage,
    SettingsPage
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    IonicModule.forRoot(),
    RouterModule.forRoot(routes, { 
      scrollPositionRestoration: 'enabled'
    }),
    ReactiveFormsModule,
    FormsModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule,
    AngularFireStorageModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy }
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent]
})
export class AppModule {}
