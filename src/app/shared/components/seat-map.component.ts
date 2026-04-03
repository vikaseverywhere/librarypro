import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';

export interface SeatInfo {
  number: number;
  status: 'vacant' | 'occupied';
  studentName?: string;
  studentId?: string;
}

@Component({
  selector: 'app-seat-map',
  template: `
    <div class="seat-map-wrapper">
      <div class="seat-legend">
        <div class="legend-item">
          <div class="legend-box vacant"></div>
          <span>Available</span>
        </div>
        <div class="legend-item">
          <div class="legend-box occupied"></div>
          <span>Occupied</span>
        </div>
        <div class="legend-item" *ngIf="mode === 'select'">
          <div class="legend-box selected"></div>
          <span>Selected</span>
        </div>
      </div>

      <div class="seat-grid" [style.grid-template-columns]="'repeat(' + columns + ', 1fr)'">
        <div
          *ngFor="let seat of seats"
          class="seat"
          [class.occupied]="seat.status === 'occupied'"
          [class.vacant]="seat.status === 'vacant'"
          [class.selected]="selectedSeat === seat.number"
          [class.selectable]="mode === 'select' && seat.status === 'vacant'"
          [class.editing-current]="mode === 'select' && editingStudentSeat === seat.number"
          (click)="onSeatClick(seat)"
        >
          <div class="seat-number">{{ seat.number }}</div>
          <div class="seat-icon">
            <ion-icon
              *ngIf="seat.status === 'occupied'"
              name="person"
            ></ion-icon>
            <ion-icon
              *ngIf="seat.status === 'vacant'"
              name="square-outline"
            ></ion-icon>
          </div>
          <div class="seat-name" *ngIf="seat.studentName && showNames">
            {{ seat.studentName | slice:0:8 }}
          </div>
        </div>
      </div>

      <div class="seat-summary">
        <span class="summary-item occupied-count">
          <strong>{{ occupiedCount }}</strong> Occupied
        </span>
        <span class="summary-item vacant-count">
          <strong>{{ vacantCount }}</strong> Available
        </span>
        <span class="summary-item total-count">
          <strong>{{ totalSeats }}</strong> Total
        </span>
      </div>
    </div>
  `,
  styles: [`
    .seat-map-wrapper {
      background: #f8fafc;
      border-radius: 14px;
      padding: 16px;
    }

    .seat-legend {
      display: flex;
      justify-content: center;
      gap: 18px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      color: #475569;
      font-weight: 600;
    }

    .legend-box {
      width: 20px;
      height: 20px;
      border-radius: 4px;

      &.vacant {
        background: #e2e8f0;
        border: 2px solid #cbd5e1;
      }
      &.occupied {
        background: #3b82f6;
        border: 2px solid #2563eb;
      }
      &.selected {
        background: #22c55e;
        border: 2px solid #16a34a;
      }
    }

    .seat-grid {
      display: grid;
      gap: 6px;
      justify-items: center;
      margin-bottom: 16px;
    }

    .seat {
      width: 100%;
      max-width: 52px;
      aspect-ratio: 1;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: default;
      transition: all 0.15s ease;
      position: relative;
      border: 2px solid transparent;

      .seat-number {
        font-size: 0.7rem;
        font-weight: 700;
        line-height: 1;
      }

      .seat-icon {
        font-size: 14px;
        line-height: 1;
      }

      .seat-name {
        font-size: 0.55rem;
        line-height: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        padding: 0 2px;
      }

      &.vacant {
        background: #e2e8f0;
        border-color: #cbd5e1;
        .seat-number { color: #64748b; }
        .seat-icon { color: #94a3b8; }
      }

      &.occupied {
        background: #3b82f6;
        border-color: #2563eb;
        .seat-number { color: #fff; }
        .seat-icon { color: #dbeafe; }
        .seat-name { color: #e0f2fe; }
      }

      &.selectable {
        cursor: pointer;
        &:hover {
          background: #bbf7d0;
          border-color: #22c55e;
          transform: scale(1.08);
          .seat-number { color: #166534; }
          .seat-icon { color: #16a34a; }
        }
      }

      &.selected {
        background: #22c55e !important;
        border-color: #16a34a !important;
        transform: scale(1.1);
        box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
        .seat-number { color: #fff; }
        .seat-icon { color: #fff; }
      }

      &.editing-current {
        background: #f59e0b;
        border-color: #d97706;
        .seat-number { color: #fff; }
        .seat-icon { color: #fff; }
        .seat-name { color: #fef9c3; }
      }
    }

    .seat-summary {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;

      .summary-item {
        font-size: 0.85rem;
        font-weight: 600;

        strong { margin-right: 3px; }

        &.occupied-count { color: #2563eb; }
        &.vacant-count { color: #16a34a; }
        &.total-count { color: #475569; }
      }
    }
  `]
})
export class SeatMapComponent implements OnChanges {
  @Input() totalSeats = 0;
  @Input() occupiedSeats: SeatInfo[] = [];
  @Input() mode: 'view' | 'select' = 'view';
  @Input() selectedSeat: number | null = null;
  @Input() editingStudentSeat: number | null = null;
  @Input() showNames = true;

  @Output() seatSelected = new EventEmitter<number>();

  seats: SeatInfo[] = [];
  columns = 10;
  occupiedCount = 0;
  vacantCount = 0;

  ngOnChanges() {
    this.buildGrid();
  }

  private buildGrid() {
    if (this.totalSeats <= 0) {
      this.seats = [];
      return;
    }

    // Auto columns: aim for ~10 per row but adjust for smaller totals
    this.columns = this.totalSeats <= 20 ? 5 :
                   this.totalSeats <= 50 ? 8 : 10;

    const occupiedMap = new Map<number, SeatInfo>();
    for (const s of this.occupiedSeats) {
      occupiedMap.set(s.number, s);
    }

    this.seats = [];
    for (let i = 1; i <= this.totalSeats; i++) {
      const occ = occupiedMap.get(i);
      this.seats.push({
        number: i,
        status: occ ? 'occupied' : 'vacant',
        studentName: occ?.studentName,
        studentId: occ?.studentId
      });
    }

    this.occupiedCount = this.occupiedSeats.length;
    this.vacantCount = this.totalSeats - this.occupiedCount;
  }

  onSeatClick(seat: SeatInfo) {
    if (this.mode !== 'select') return;
    // Allow clicking on vacant seats OR the current student's own seat (for edit)
    if (seat.status === 'vacant' || seat.number === this.editingStudentSeat) {
      this.seatSelected.emit(seat.number);
    }
  }
}
