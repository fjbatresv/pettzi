import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  RoutineActivity,
  RoutineStatus,
  RoutineType,
} from '@pettzi/domain-model';
import { TranslateModule } from '@ngx-translate/core';
import { CreateRoutineActivityRequest } from '../../core/services/routines.service';

export interface RoutineDialogData {
  activity?: RoutineActivity | null;
  timezone?: string;
}

export type RoutineDialogResult = CreateRoutineActivityRequest;

@Component({
  selector: 'app-routine-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    TranslateModule,
  ],
  templateUrl: './routine-dialog.component.html',
  styleUrl: './routine-dialog.component.scss',
})
export class RoutineDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RoutineDialogComponent>);
  private readonly data = inject<RoutineDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  private readonly activity = this.data.activity ?? null;

  title = this.activity?.title ?? '';
  type = this.activity?.type ?? RoutineType.CUSTOM;
  notes = this.activity?.notes ?? '';
  routineTimezone = this.data.timezone ?? 'America/Guatemala';
  status: RoutineStatus.ACTIVE | RoutineStatus.PAUSED =
    this.activity?.status === RoutineStatus.PAUSED
      ? RoutineStatus.PAUSED
      : RoutineStatus.ACTIVE;
  frequency = this.activity?.schedule.frequency ?? 'DAILY';
  timesText = this.getTimesText();
  daysOfWeekText = this.activity?.schedule.frequency === 'WEEKLY'
    ? this.activity.schedule.daysOfWeek.join(', ')
    : '';
  daysOfMonthText = this.activity?.schedule.frequency === 'MONTHLY'
    ? this.activity.schedule.daysOfMonth.join(', ')
    : '';

  readonly routineTypes = Object.values(RoutineType);
  readonly routineStatuses = [RoutineStatus.ACTIVE, RoutineStatus.PAUSED];

  get isEditMode() {
    return Boolean(this.activity);
  }

  get isFormValid() {
    if (!this.title.trim()) {
      return false;
    }
    const times = this.parseTextList(this.timesText);
    if (!times.length || !times.every((time) => this.isValidTime(time))) {
      return false;
    }
    if (this.frequency === 'WEEKLY') {
      const days = this.parseNumberList(this.daysOfWeekText);
      return days.length > 0 && days.every((day) => day >= 0 && day <= 6);
    }
    if (this.frequency === 'MONTHLY') {
      const days = this.parseNumberList(this.daysOfMonthText);
      return days.length > 0 && days.every((day) => day >= 1 && day <= 31);
    }
    return true;
  }

  close() {
    this.dialogRef.close();
  }

  save() {
    if (!this.isFormValid) {
      return;
    }
    const result: RoutineDialogResult = {
      title: this.title.trim(),
      type: this.type,
      notes: this.notes.trim() || undefined,
      status: this.status,
      routineTimezone: this.routineTimezone,
      schedule: this.buildSchedule(),
    };
    this.dialogRef.close(result);
  }

  private buildSchedule(): RoutineActivity['schedule'] {
    const times = this.parseTextList(this.timesText);
    if (this.frequency === 'WEEKLY') {
      return {
        frequency: 'WEEKLY',
        daysOfWeek: this.parseNumberList(this.daysOfWeekText),
        times,
      };
    }
    if (this.frequency === 'MONTHLY') {
      return {
        frequency: 'MONTHLY',
        daysOfMonth: this.parseNumberList(this.daysOfMonthText),
        times,
      };
    }
    return {
      frequency: 'DAILY',
      times,
    };
  }

  private parseTextList(value: string) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private parseNumberList(value: string) {
    return this.parseTextList(value)
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }

  private isValidTime(value: string) {
    return /^\d{2}:\d{2}$/.test(value.trim());
  }

  private getTimesText() {
    if (!this.activity) {
      return '';
    }
    return this.activity.schedule.times.join(', ');
  }
}
