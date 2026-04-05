import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouteReuseStrategy } from '@angular/router';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';
import { ErrorHandler } from '@angular/core';

import { AppComponent } from './app.component';
import { TabsComponent } from './tabs/tabs.component';
import { AuthGuard } from './core/auth/auth.guard';
import { GlobalErrorHandler } from './core/global-error-handler';

// Firebase
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireFunctionsModule } from '@angular/fire/compat/functions';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';

import { environment } from '../environments/environment';

const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./modules/auth/auth.module').then(m => m.AuthModule) },
  {
    path: 'tabs',
    component: TabsComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'dashboard',    loadChildren: () => import('./modules/dashboard/dashboard.module').then(m => m.DashboardModule) },
      { path: 'students',     loadChildren: () => import('./modules/students/students.module').then(m => m.StudentsModule) },
      { path: 'libraries',    loadChildren: () => import('./modules/libraries/libraries.module').then(m => m.LibrariesModule) },
      { path: 'fees',         loadChildren: () => import('./modules/fees/fees.module').then(m => m.FeesModule) },
      { path: 'transactions', loadChildren: () => import('./modules/transactions/transactions.module').then(m => m.TransactionsModule) },
      { path: 'settings',     loadChildren: () => import('./modules/settings/settings.module').then(m => m.SettingsModule) },
      { path: 'plans',        loadChildren: () => import('./modules/plans/plans.module').then(m => m.PlansModule) },
      { path: '',             redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  // Keep old routes as redirects for backwards compatibility
  { path: 'dashboard',    redirectTo: 'tabs/dashboard',    pathMatch: 'full' },
  { path: 'students',     redirectTo: 'tabs/students',     pathMatch: 'full' },
  { path: 'fees',         redirectTo: 'tabs/fees',         pathMatch: 'full' },
  { path: 'transactions', redirectTo: 'tabs/transactions', pathMatch: 'full' },
  { path: 'settings',     redirectTo: 'tabs/settings',     pathMatch: 'full' },
  { path: 'plans',        redirectTo: 'tabs/plans',        pathMatch: 'full' },
  { path: 'libraries',    redirectTo: 'tabs/libraries',    pathMatch: 'full' },
  { path: '',             redirectTo: 'auth/login',        pathMatch: 'full' },
  { path: '**',           redirectTo: 'auth/login' }
];

@NgModule({
  declarations: [
    AppComponent,
    TabsComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    IonicModule.forRoot(),
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'enabled'
    }),
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule.enablePersistence({ synchronizeTabs: true }),
    AngularFireFunctionsModule,
    AngularFireStorageModule
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler }
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent]
})
export class AppModule {}
