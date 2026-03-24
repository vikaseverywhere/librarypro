import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { LoginPage } from './login.page';
import { SignupPage } from './signup.page';
import { AuthRoutingModule } from './auth-routing.module';

@NgModule({
  declarations: [LoginPage, SignupPage],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    FormsModule,
    AuthRoutingModule
  ]
})
export class AuthModule {}
