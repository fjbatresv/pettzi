import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

interface AttachmentPreviewData {
  url: string;
  name?: string;
}

@Component({
  selector: 'app-event-attachment-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './event-attachment-preview-dialog.component.html',
  styleUrl: './event-attachment-preview-dialog.component.scss',
})
export class EventAttachmentPreviewDialogComponent {
  readonly data = inject<AttachmentPreviewData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<EventAttachmentPreviewDialogComponent>);

  close() {
    this.dialogRef.close();
  }
}
