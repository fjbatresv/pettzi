import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { OwnersService, PendingPetInvite } from '../../core/services/owners.service';

@Component({
  selector: 'app-pet-invites',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './pet-invites.component.html',
  styleUrl: './pet-invites.component.scss',
})
export class PetInvitesComponent implements OnInit {
  private readonly owners = inject(OwnersService);
  private readonly activePetKey = 'pettzi.activePetId';

  invites: PendingPetInvite[] = [];
  isLoading = true;
  errorMessage = '';
  processing: Record<string, boolean> = {};

  ngOnInit() {
    this.loadInvites();
  }

  reload() {
    this.loadInvites();
  }

  acceptInvite(invite: PendingPetInvite) {
    if (this.processing[invite.token]) {
      return;
    }
    this.processing[invite.token] = true;
    this.owners.acceptPetInvite(invite.token).subscribe({
      next: (response) => {
        if (response.pet?.petId) {
          localStorage.setItem(this.activePetKey, response.pet.petId);
        }
        this.loadInvites();
      },
      error: (err: Error) => {
        this.errorMessage = err.message;
      },
      complete: () => {
        this.processing[invite.token] = false;
      },
    });
  }

  rejectInvite(invite: PendingPetInvite) {
    if (this.processing[invite.token]) {
      return;
    }
    this.processing[invite.token] = true;
    this.owners.rejectPetInvite(invite.token).subscribe({
      next: () => {
        this.loadInvites();
      },
      error: (err: Error) => {
        this.errorMessage = err.message;
      },
      complete: () => {
        this.processing[invite.token] = false;
      },
    });
  }

  private loadInvites() {
    this.isLoading = true;
    this.errorMessage = '';
    this.owners.listPendingPetInvites().subscribe({
      next: ({ invites }) => {
        this.invites = invites ?? [];
      },
      error: (err: Error) => {
        this.errorMessage = err.message;
        this.invites = [];
      },
      complete: () => {
        this.isLoading = false;
      },
    });
  }

}
