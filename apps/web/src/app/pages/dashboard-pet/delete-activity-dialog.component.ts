import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-delete-activity-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, TranslateModule],
  templateUrl: './delete-activity-dialog.component.html',
  styleUrl: './delete-activity-dialog.component.scss',
})
export class DeleteActivityDialogComponent {}
