import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { TransactionsPage } from './transactions.page';
import { ReceiptDetailPage } from './receipt-detail.page';

const routes: Routes = [
  { path: '',     component: TransactionsPage },
  { path: ':id',  component: ReceiptDetailPage }
];

@NgModule({
  declarations: [TransactionsPage, ReceiptDetailPage],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class TransactionsModule {}
