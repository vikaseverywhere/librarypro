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
      <!-- Summary Pills at Top -->
      <div class="seat-summary-bar">
        <div class="summary-pill occupied-pill">
          <div class="pill-icon">
            <ion-icon name="person"></ion-icon>
          </div>
          <div class="pill-content">
            <span class="pill-value">{{ occupiedCount }}</span>
            <span class="pill-label">Occupied</span>
          </div>
        </div>
        <div class="summary-pill available-pill">
          <div class="pill-icon">
            <ion-icon name="checkmark-circle"></ion-icon>
          </div>
          <div class="pill-content">
            <span class="pill-value">{{ vacantCount }}</span>
            <span class="pill-label">Available</span>
          </div>
        </div>
        <div class="summary-pill total-pill">
          <div class="pill-icon">
            <ion-icon name="grid"></ion-icon>
          </div>
          <div class="pill-content">
            <span class="pill-value">{{ totalSeats }}</span>
            <span class="pill-label">Total</span>
          </div>
        </div>
      </div>

      <!-- Occupancy Progress -->
      <div class="occupancy-bar-wrapper">
        <div class="occupancy-track">
          <div class="occupancy-fill" [style.width.%]="totalSeats ? (occupiedCount / totalSeats * 100) : 0"></div>
        </div>
        <span class="occupancy-pct">{{ totalSeats ? (occupiedCount / totalSeats * 100 | number:'1.0-0') : 0 }}% Full</span>
      </div>

      <!-- Legend -->
      <div class="seat-legend">
        <div class="legend-chip vacant-chip">
          <span class="legend-dot"></span>
          Available
        </div>
        <div class="legend-chip occupied-chip">
          <span class="legend-dot"></span>
          Occupied
        </div>
        <div class="legend-chip selected-chip" *ngIf="mode === 'select'">
          <span class="legend-dot"></span>
          Selected
        </div>
      </div>

      <!-- Seat Grid -->
      <div class="seat-grid" [style.grid-template-columns]="'repeat(' + columns + ', 1fr)'">
        <div
          *ngFor="let seat of seats; let i = index"
          class="seat"
          [class.occupied]="seat.status === 'occupied'"
          [class.vacant]="seat.status === 'vacant'"
          [class.selected]="selectedSeat === seat.number"
          [class.selectable]="mode === 'select' && seat.status === 'vacant'"
          [class.editing-current]="mode === 'select' && editingStudentSeat === seat.number"
          [style.animation-delay.ms]="i * 12"
          (click)="onSeatClick(seat)"
        >
          <div class="seat-back"></div>
          <div class="seat-body">
            <span class="seat-number">{{ seat.number }}</span>
            <span class="seat-name" *ngIf="seat.studentName && showNames">{{ seat.studentName | slice:0:7 }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .seat-map-wrapper {
      background: linear-gradient(160deg, #f0f6ff 0%, #f8fbff 50%, #f0f4ff 100%);
      border-radius: 16px;
      padding: 20px 16px 16px;
      position: relative;
      overflow: visible;
    }

    .seat-map-wrapper::before {
      content: '';
      position: absolute;
      top: -60px;
      right: -60px;
      width: 160px;
      height: 160px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(43,124,212,0.06) 0%, transparent 70%);
      pointer-events: none;
    }

    .seat-map-wrapper::after {
      content: '';
      position: absolute;
      bottom: -40px;
      left: -40px;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%);
      pointer-events: none;
    }

    /* ─── Summary Bar ─── */
    .seat-summary-bar {
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 14px;
      position: relative;
      z-index: 1;
    }

    .summary-pill {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 12px;
      background: white;
      box-shadow: 0 2px 8px rgba(16,71,122,0.07);
      border: 1px solid rgba(30,80,130,0.06);
      min-width: 95px;
    }

    .pill-icon {
      width: 30px;
      height: 30px;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      flex-shrink: 0;
    }

    .occupied-pill .pill-icon {
      background: linear-gradient(135deg, #dbeafe, #bfdbfe);
      color: #2563eb;
    }
    .available-pill .pill-icon {
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      color: #059669;
    }
    .total-pill .pill-icon {
      background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
      color: #4f46e5;
    }

    .pill-content {
      display: flex;
      flex-direction: column;
      line-height: 1.1;
    }

    .pill-value {
      font-size: 1.05rem;
      font-weight: 800;
      color: #1e3a5f;
    }

    .pill-label {
      font-size: 0.65rem;
      font-weight: 600;
      color: #8896ab;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    /* ─── Occupancy Progress ─── */
    .occupancy-bar-wrapper {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      padding: 0 4px;
      position: relative;
      z-index: 1;
    }

    .occupancy-track {
      flex: 1;
      height: 6px;
      border-radius: 6px;
      background: #e2e8f0;
      overflow: hidden;
    }

    .occupancy-fill {
      height: 100%;
      border-radius: 6px;
      background: linear-gradient(90deg, #3b82f6 0%, #2563eb 60%, #6366f1 100%);
      transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
      position: relative;
    }

    .occupancy-fill::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%);
      animation: shimmer 2.5s infinite;
    }

    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .occupancy-pct {
      font-size: 0.72rem;
      font-weight: 700;
      color: #475569;
      white-space: nowrap;
      min-width: 50px;
      text-align: right;
    }

    /* ─── Legend ─── */
    .seat-legend {
      display: flex;
      justify-content: center;
      gap: 8px;
      margin-bottom: 16px;
      position: relative;
      z-index: 1;
    }

    .legend-chip {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 0.7rem;
      font-weight: 600;
      color: #64748b;
      padding: 4px 10px;
      border-radius: 20px;
      background: rgba(255,255,255,0.7);
      border: 1px solid rgba(0,0,0,0.05);
    }

    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .vacant-chip .legend-dot {
      background: linear-gradient(135deg, #cbd5e1, #94a3b8);
      box-shadow: 0 0 0 2px rgba(148,163,184,0.2);
    }
    .occupied-chip .legend-dot {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
    }
    .selected-chip .legend-dot {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      box-shadow: 0 0 0 2px rgba(34,197,94,0.2);
    }

    /* ─── Seat Grid ─── */
    .seat-grid {
      display: grid;
      gap: 7px;
      justify-items: center;
      margin-bottom: 6px;
      position: relative;
      z-index: 1;
    }

    /* ─── Individual Seat ─── */
    .seat {
      width: 100%;
      max-width: 56px;
      aspect-ratio: 0.82;
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: default;
      position: relative;
      animation: seatAppear 0.4s ease both;
    }

    @keyframes seatAppear {
      from {
        opacity: 0;
        transform: scale(0.85) translateY(6px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    /* Seat back (the top curved part) */
    .seat-back {
      width: 80%;
      height: 8px;
      border-radius: 8px 8px 2px 2px;
      transition: all 0.25s ease;
    }

    /* Seat body (main area) */
    .seat-body {
      width: 100%;
      flex: 1;
      border-radius: 4px 4px 8px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      transition: all 0.25s ease;
      position: relative;
      overflow: hidden;
    }

    .seat-number {
      font-size: 0.72rem;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.2px;
    }

    .seat-name {
      font-size: 0.5rem;
      font-weight: 600;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      padding: 0 3px;
      opacity: 0.85;
    }

    /* ─── Vacant State ─── */
    .seat.vacant .seat-back {
      background: linear-gradient(180deg, #d1d8e0, #c1c9d4);
    }
    .seat.vacant .seat-body {
      background: linear-gradient(180deg, #e8edf2, #dfe4eb);
      border: 1.5px solid #cdd4de;
      border-top: none;
    }
    .seat.vacant .seat-number { color: #7e8da0; }

    .seat.vacant:hover .seat-body {
      background: linear-gradient(180deg, #edf1f6, #e3e8ef);
      border-color: #b8c2cf;
    }

    /* ─── Occupied State ─── */
    .seat.occupied .seat-back {
      background: linear-gradient(180deg, #2563eb, #1d4ed8);
      box-shadow: 0 -1px 4px rgba(37,99,235,0.3);
    }
    .seat.occupied .seat-body {
      background: linear-gradient(160deg, #3b82f6 0%, #2563eb 100%);
      border: 1.5px solid rgba(37,99,235,0.4);
      border-top: none;
      box-shadow: 0 3px 10px rgba(37,99,235,0.25), inset 0 1px 0 rgba(255,255,255,0.1);
    }
    .seat.occupied .seat-number { color: #fff; }
    .seat.occupied .seat-name { color: #dbeafe; }

    .seat.occupied .seat-body::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 50%;
      bottom: 0;
      background: linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 100%);
      border-radius: 4px 0 0 8px;
      pointer-events: none;
    }

    .seat.occupied:hover .seat-body {
      box-shadow: 0 4px 14px rgba(37,99,235,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
      transform: translateY(-1px);
    }

    /* ─── Selectable (vacant in select mode) ─── */
    .seat.selectable {
      cursor: pointer;
    }
    .seat.selectable:hover .seat-back {
      background: linear-gradient(180deg, #22c55e, #16a34a);
    }
    .seat.selectable:hover .seat-body {
      background: linear-gradient(160deg, #bbf7d0 0%, #86efac 100%);
      border-color: #22c55e;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(34,197,94,0.25);
    }
    .seat.selectable:hover .seat-number { color: #166534; }

    /* ─── Selected State ─── */
    .seat.selected .seat-back {
      background: linear-gradient(180deg, #16a34a, #15803d) !important;
      box-shadow: 0 -1px 4px rgba(22,163,74,0.3);
    }
    .seat.selected .seat-body {
      background: linear-gradient(160deg, #22c55e 0%, #16a34a 100%) !important;
      border-color: rgba(22,163,74,0.4) !important;
      transform: translateY(-2px) !important;
      box-shadow: 0 4px 16px rgba(34,197,94,0.35), inset 0 1px 0 rgba(255,255,255,0.15) !important;
    }
    .seat.selected .seat-number { color: #fff !important; }

    /* ─── Editing Current ─── */
    .seat.editing-current .seat-back {
      background: linear-gradient(180deg, #f59e0b, #d97706);
    }
    .seat.editing-current .seat-body {
      background: linear-gradient(160deg, #fbbf24 0%, #f59e0b 100%);
      border-color: rgba(217,119,6,0.4);
      border-top: none;
      box-shadow: 0 3px 10px rgba(245,158,11,0.3);
    }
    .seat.editing-current .seat-number { color: #fff; }
    .seat.editing-current .seat-name { color: #fef9c3; }

    /* ─── Responsive ─── */
    @media (max-width: 480px) {
      .seat-map-wrapper { padding: 14px 6px 12px; }
      .seat-summary-bar { gap: 6px; }
      .summary-pill { padding: 6px 8px; min-width: 0; }
      .pill-icon { width: 24px; height: 24px; font-size: 12px; border-radius: 7px; }
      .pill-value { font-size: 0.85rem; }
      .pill-label { font-size: 0.6rem; }
      .occupancy-bar-wrapper { padding: 0 2px; }
      .seat-legend { gap: 6px; margin-bottom: 12px; }
      .seat-grid { gap: 4px; }
      .seat { max-width: 40px; }
      .seat-number { font-size: 0.62rem; }
      .seat-name { font-size: 0.45rem; }
    }

    /* ─── Occupied seat clickable in view mode ─── */
    .seat.occupied { cursor: pointer; }
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
  @Output() seatTapped = new EventEmitter<SeatInfo>();

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
    if (this.mode === 'select') {
      if (seat.status === 'vacant' || seat.number === this.editingStudentSeat) {
        this.seatSelected.emit(seat.number);
      }
      return;
    }

    // View mode: emit tap for occupied seats
    if (seat.status === 'occupied') {
      this.seatTapped.emit(seat);
    }
  }
}
