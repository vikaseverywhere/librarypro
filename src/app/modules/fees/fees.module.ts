import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { FeesPage } from './fees.page';
import { CollectFeePage } from './collect-fee/collect-fee.page';

const routes: Routes = [
  { path: '',         component: FeesPage },
  { path: 'collect',  component: CollectFeePage }
];

@NgModule({
  declarations: [FeesPage, CollectFeePage],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class FeesModule {}
