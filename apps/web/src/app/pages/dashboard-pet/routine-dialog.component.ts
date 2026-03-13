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
  RoutineDefinition,
  RoutineStatus,
  RoutineType,
} from '@pettzi/domain-model';
import { TranslateModule } from '@ngx-translate/core';
import { CreateRoutineRequest } from '../../core/services/routines.service';

export interface RoutineDialogData {
  routine?: RoutineDefinition | null;
  timezone?: string;
}

export interface RoutineDialogResult extends CreateRoutineRequest {
  status?: RoutineStatus;
}

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

  private readonly routine = this.data.routine ?? null;

  title = this.routine?.title ?? '';
  type = this.routine?.type ?? RoutineType.CUSTOM;
  notes = this.routine?.notes ?? '';
  timezone = this.routine?.timezone ?? this.data.timezone ?? 'America/Guatemala';
  status = this.routine?.status ?? RoutineStatus.ACTIVE;
  frequency = this.routine?.schedule.frequency ?? 'DAILY';
  timesText = this.getTimesText();
  daysOfWeekText = this.routine?.schedule.frequency === 'WEEKLY'
    ? this.routine.schedule.daysOfWeek.join(', ')
    : '';
  daysOfMonthText = this.routine?.schedule.frequency === 'MONTHLY'
    ? this.routine.schedule.daysOfMonth.join(', ')
    : '';
  intervalHours = this.routine?.schedule.frequency === 'HOURLY_INTERVAL'
    ? this.routine.schedule.intervalHours
    : 12;
  anchorTime = this.routine?.schedule.frequency === 'HOURLY_INTERVAL'
    ? this.routine.schedule.anchorTime
    : '08:00';

  readonly routineTypes = Object.values(RoutineType);
  readonly routineStatuses = Object.values(RoutineStatus);

  get isEditMode() {
    return Boolean(this.routine);
  }

  get isFormValid() {
    if (!this.title.trim() || !this.timezone.trim()) {
      return false;
    }
    if (this.frequency === 'HOURLY_INTERVAL') {
      return this.intervalHours >= 1 && this.isValidTime(this.anchorTime);
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
      timezone: this.timezone.trim(),
      status: this.status,
      schedule: this.buildSchedule(),
    };
    this.dialogRef.close(result);
  }

  private buildSchedule(): RoutineDefinition['schedule'] {
    if (this.frequency === 'HOURLY_INTERVAL') {
      return {
        frequency: 'HOURLY_INTERVAL',
        intervalHours: this.intervalHours,
        anchorTime: this.anchorTime.trim(),
      };
    }
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
    if (!this.routine) {
      return '';
    }
    if (this.routine.schedule.frequency === 'HOURLY_INTERVAL') {
      return '';
    }
    return this.routine.schedule.times.join(', ');
  }
}
