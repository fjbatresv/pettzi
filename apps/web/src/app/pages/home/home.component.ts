import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { API_BASE_URL } from '../../core/tokens';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly apiBaseUrl = inject(API_BASE_URL);
}
