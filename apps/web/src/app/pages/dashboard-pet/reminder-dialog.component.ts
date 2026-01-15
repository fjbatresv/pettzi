import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { TranslateModule } from '@ngx-translate/core';

export type ReminderDialogResult = {
  title: string;
  dueDate: Date;
  notes?: string;
  recurring: boolean;
  periodicity?: Record<string, unknown>;
};

@Component({
  selector: 'app-reminder-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTimepickerModule,
    TranslateModule,
  ],
  templateUrl: './reminder-dialog.component.html',
  styleUrl: './reminder-dialog.component.scss',
})
export class ReminderDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ReminderDialogComponent>);

  title = '';
  dueDate: Date | null = null;
  time: Date | null = null;
  notes = '';
  recurring = false;
  periodicity: 'hours' | 'daily' | 'weekly' | 'monthly' = 'daily';
  hoursEvery = 12;
  dailyTime: Date | null = null;
  weeklyDay = '1';
  weeklyTime: Date | null = null;
  monthlyDay = 1;
  monthlyTime: Date | null = null;

  get isFormValid() {
    if (!this.title.trim() || !this.dueDate || !this.time) {
      return false;
    }
    if (!this.recurring) {
      return true;
    }
    if (this.periodicity === 'hours') {
      return this.hoursEvery >= 1;
    }
    if (this.periodicity === 'daily') {
      return Boolean(this.dailyTime);
    }
    if (this.periodicity === 'weekly') {
      return Boolean(this.weeklyTime) && this.weeklyDay !== '';
    }
    if (this.periodicity === 'monthly') {
      return Boolean(this.monthlyTime) && this.monthlyDay >= 1;
    }
    return false;
  }

  close() {
    this.dialogRef.close();
  }

  save() {
    if (!this.isFormValid || !this.dueDate || !this.time) {
      return;
    }
    const due = new Date(this.dueDate);
    due.setHours(this.time.getHours(), this.time.getMinutes(), 0, 0);
    if (Number.isNaN(due.getTime())) {
      return;
    }
    const result: ReminderDialogResult = {
      title: this.title.trim(),
      dueDate: due,
      notes: this.notes.trim() || undefined,
      recurring: this.recurring,
      periodicity: this.recurring ? this.buildPeriodicity() : undefined,
    };
    this.dialogRef.close(result);
  }

  private buildPeriodicity() {
    switch (this.periodicity) {
      case 'hours':
        return { type: 'hours', everyHours: this.hoursEvery };
      case 'daily':
        return { type: 'daily', time: this.timeToString(this.dailyTime) };
      case 'weekly':
        return {
          type: 'weekly',
          weekday: Number(this.weeklyDay),
          time: this.timeToString(this.weeklyTime),
        };
      case 'monthly':
        return {
          type: 'monthly',
          dayOfMonth: this.monthlyDay,
          time: this.timeToString(this.monthlyTime),
        };
      default:
        return { type: 'daily' };
    }
  }

  private timeToString(value: Date | null) {
    if (!value) {
      return '';
    }
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
