import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../../shared/shared.module';
import { LibrariesPage } from './libraries.page';
import { LibraryCreatePage } from './library-create.page';

const routes: Routes = [
  { path: '',     component: LibrariesPage },
  { path: 'add',  component: LibraryCreatePage }
];

@NgModule({
  declarations: [LibrariesPage, LibraryCreatePage],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LibrariesModule {}
