import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { SeatMapComponent } from './components/seat-map.component';
import { AppHeaderComponent } from './components/app-header/app-header.component';
import { LibrarySwitcherComponent } from './components/library-switcher/library-switcher.component';
import { LibrarySwitcherModalComponent } from './components/library-switcher/library-switcher-modal.component';

@NgModule({
  declarations: [
    SeatMapComponent,
    AppHeaderComponent,
    LibrarySwitcherComponent,
    LibrarySwitcherModalComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  exports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule,
    SeatMapComponent,
    AppHeaderComponent,
    LibrarySwitcherComponent,
    LibrarySwitcherModalComponent
  ]
})
export class SharedModule {}
