import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouteReuseStrategy } from '@angular/router';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { AuthGuard } from './core/auth/auth.guard';
import { ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from './core/global-error-handler';

// Firebase
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireFunctionsModule } from '@angular/fire/compat/functions';

import { environment } from '../environments/environment';

// Feature Pages
import { DashboardPage } from './modules/dashboard/dashboard.page';
import { StudentsPage } from './modules/students/students.page';
import { StudentFormPage } from './modules/students/student-form/student-form.page';
import { FeesPage } from './modules/fees/fees.page';
import { CollectFeePage } from './modules/fees/collect-fee/collect-fee.page';
import { SettingsPage } from './modules/settings/settings.page';
import { LibrariesPage } from './modules/libraries/libraries.page';
import { LibraryCreatePage } from './modules/libraries/library-create.page';
import { TransactionsPage } from './modules/transactions/transactions.page';
import { ReceiptDetailPage } from './modules/transactions/receipt-detail.page';
import { StudentProfilePage } from './modules/students/student-profile/student-profile.page';
import { PlansPage } from './modules/plans/plans.page';
import { SeatMapComponent } from './shared/components/seat-map.component';
import { LibrarySwitcherComponent } from './shared/components/library-switcher/library-switcher.component';
import { LibrarySwitcherModalComponent } from './shared/components/library-switcher/library-switcher-modal.component';
import { AppHeaderComponent } from './shared/components/app-header/app-header.component';
import { TabsComponent } from './tabs/tabs.component';

const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule) },
  {
    path: 'tabs',
    component: TabsComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard',            component: DashboardPage },
      { path: 'students/add',         component: StudentFormPage },
      { path: 'students/edit/:id',    component: StudentFormPage },
      { path: 'students/profile/:id', component: StudentProfilePage },
      { path: 'students',             component: StudentsPage },
      { path: 'libraries/add',        component: LibraryCreatePage },
      { path: 'libraries',            component: LibrariesPage },
      { path: 'fees/collect',         component: CollectFeePage },
      { path: 'fees',                 component: FeesPage },
      { path: 'transactions/:id',     component: ReceiptDetailPage },
      { path: 'transactions',         component: TransactionsPage },
      { path: 'settings',             component: SettingsPage },
      { path: 'plans',                component: PlansPage },
      { path: '',                     redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  // Keep old routes as redirects for backwards compatibility
  { path: 'dashboard',         redirectTo: 'tabs/dashboard', pathMatch: 'full' },
  { path: 'students',          redirectTo: 'tabs/students', pathMatch: 'full' },
  { path: 'fees',              redirectTo: 'tabs/fees', pathMatch: 'full' },
  { path: 'transactions',      redirectTo: 'tabs/transactions', pathMatch: 'full' },
  { path: 'settings',          redirectTo: 'tabs/settings', pathMatch: 'full' },
  { path: 'plans',             redirectTo: 'tabs/plans', pathMatch: 'full' },
  { path: 'libraries',         redirectTo: 'tabs/libraries', pathMatch: 'full' },
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
    SettingsPage,
    LibrariesPage,
    LibraryCreatePage,
    TransactionsPage,
    ReceiptDetailPage,
    StudentProfilePage,
    PlansPage,
    SeatMapComponent,
    LibrarySwitcherComponent,
    LibrarySwitcherModalComponent,
    AppHeaderComponent,
    TabsComponent
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
    AngularFirestoreModule.enablePersistence({ synchronizeTabs: true }),
    AngularFireFunctionsModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent]
})
export class AppModule {}
