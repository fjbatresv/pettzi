import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

interface DeletePetDialogData {
  word: string;
  petName: string;
}

@Component({
  selector: 'app-delete-pet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    TranslateModule,
  ],
  templateUrl: './delete-pet-dialog.component.html',
  styleUrl: './delete-pet-dialog.component.scss',
})
export class DeletePetDialogComponent {
  readonly data = inject<DeletePetDialogData>(MAT_DIALOG_DATA);
  confirmInput = '';

  get isMatch() {
    return this.confirmInput.trim() === this.data.word;
  }
}
