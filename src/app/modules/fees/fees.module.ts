import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { FeesPage } from './fees.page';
import { CollectFeePage } from './collect-fee/collect-fee.page';
import { EditFeePage } from './edit-fee/edit-fee.page';

const routes: Routes = [
  { path: '',         component: FeesPage },
  { path: 'collect',  component: CollectFeePage },
  { path: 'edit/:id', component: EditFeePage }
];

@NgModule({
  declarations: [FeesPage, CollectFeePage, EditFeePage],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class FeesModule {}
