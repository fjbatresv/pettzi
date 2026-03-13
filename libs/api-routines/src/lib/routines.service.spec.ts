import {
  RoutineOccurrenceStatus,
  RoutineStatus,
  RoutineType,
} from '@pettzi/domain-model';
import {
  generateOccurrencesForRoutine,
  getWindow,
  validateCreateRoutine,
} from './routines.service';

describe('routines.service', () => {
  const routine = {
    routineId: 'rt-1',
    petId: 'pet-1',
    ownerUserId: 'owner-1',
    title: 'Morning walk',
    type: RoutineType.WALKING,
    status: RoutineStatus.ACTIVE,
    timezone: 'America/Guatemala',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('validates create payload', () => {
    expect(() =>
      validateCreateRoutine({
        title: ' Morning walk ',
        type: RoutineType.WALKING,
        timezone: 'America/Guatemala',
        schedule: { frequency: 'DAILY', times: ['07:00', '07:00'] },
      })
    ).not.toThrow();
  });

  it('generates daily occurrences in window order', () => {
    const now = new Date('2026-01-10T00:00:00.000Z');
    const { start, end } = getWindow(now);
    const occurrences = generateOccurrencesForRoutine(
      {
        ...routine,
        schedule: { frequency: 'DAILY', times: ['07:00', '18:00'] },
      },
      start,
      end
    );

    expect(occurrences.length).toBeGreaterThan(10);
    expect(occurrences[0]?.scheduledFor.getTime()).toBeLessThan(
      occurrences[1]?.scheduledFor.getTime()
    );
  });

  it('generates weekly occurrences only for selected weekdays', () => {
    const occurrences = generateOccurrencesForRoutine(
      {
        ...routine,
        schedule: { frequency: 'WEEKLY', daysOfWeek: [1], times: ['08:00'] },
      },
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-31T23:59:59.000Z')
    );

    expect(occurrences.length).toBeGreaterThan(3);
  });

  it('marks generated past occurrences as missed', () => {
    const occurrences = generateOccurrencesForRoutine(
      {
        ...routine,
        schedule: { frequency: 'DAILY', times: ['00:00'] },
      },
      new Date('2025-01-01T00:00:00.000Z'),
      new Date('2025-01-03T00:00:00.000Z')
    );

    expect(occurrences.every((item) => item.status === RoutineOccurrenceStatus.MISSED)).toBe(true);
  });

  it('supports hourly interval and monthly schedules', () => {
    const hourly = generateOccurrencesForRoutine(
      {
        ...routine,
        schedule: { frequency: 'HOURLY_INTERVAL', intervalHours: 12, anchorTime: '08:00' },
      },
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-03T23:59:59.000Z')
    );
    const monthly = generateOccurrencesForRoutine(
      {
        ...routine,
        schedule: { frequency: 'MONTHLY', daysOfMonth: [1, 15], times: ['09:00'] },
      },
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-02-28T23:59:59.000Z')
    );

    expect(hourly.length).toBeGreaterThan(3);
    expect(monthly.length).toBe(4);
  });
});
