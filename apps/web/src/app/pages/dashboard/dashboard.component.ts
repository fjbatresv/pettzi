import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PetsService } from '../../core/services/pets.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly pets = inject(PetsService);
  private readonly router = inject(Router);

  ngOnInit() {
    this.pets.listPets().subscribe({
      next: ({ pets }) => {
        const count = (pets ?? []).length;
        if (count === 0) {
          void this.router.navigate(['/pets/new']);
          return;
        }
        if (count === 1) {
          void this.router.navigate(['/pets', pets?.[0]?.petId]);
          return;
        }
        // stay on /home for multi-pet view
      },
      error: () => {
        void this.router.navigate(['/login']);
      },
    });
  }
}
