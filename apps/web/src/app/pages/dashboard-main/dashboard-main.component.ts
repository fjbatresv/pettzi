import { CommonModule } from '@angular/common';
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-dashboard-main',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-main.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './dashboard-main.component.scss',
})
export class DashboardMainComponent {}
