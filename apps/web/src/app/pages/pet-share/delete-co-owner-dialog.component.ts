import { CommonModule } from '@angular/common';
import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';

interface DeleteCoOwnerDialogData {
  ownerName: string;
}

@Component({
  selector: 'app-delete-co-owner-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, TranslateModule],
  templateUrl: './delete-co-owner-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './delete-co-owner-dialog.component.scss',
})
export class DeleteCoOwnerDialogComponent {
  readonly data = inject<DeleteCoOwnerDialogData>(MAT_DIALOG_DATA);
}
