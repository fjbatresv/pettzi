import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { badRequest, notFound } from '@pettzi/utils-dynamo/http';
import {
  buildPetRoutineOccurrencePk,
  buildPetRoutineSk,
  buildPetRoutinePk,
  fromItemRoutineDefinition,
  fromItemRoutineOccurrence,
  RoutineDefinition,
  RoutineOccurrence,
  RoutineOccurrenceStatus,
  RoutineSchedule,
  RoutineStatus,
  RoutineType,
  toItemRoutineDefinition,
  toItemRoutineOccurrence,
} from '@pettzi/domain-model';
import { docClient, PETTZI_TABLE_NAME } from '../handlers/common';

const PAST_WINDOW_DAYS = 14;
const FUTURE_WINDOW_DAYS = 30;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export interface RoutineOccurrenceExpanded extends RoutineOccurrence {
  routine: RoutineDefinition;
}

export interface CreateRoutineInput {
  title: string;
  type: RoutineType;
  notes?: string;
  timezone: string;
  schedule: RoutineSchedule;
}

export interface UpdateRoutineInput {
  title?: string;
  type?: RoutineType;
  notes?: string;
  timezone?: string;
  status?: RoutineStatus;
  schedule?: RoutineSchedule;
}

export const getWindow = (now = new Date()) => {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - PAST_WINDOW_DAYS);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + FUTURE_WINDOW_DAYS);
  return { start, end };
};

const isValidTimeZone = (value: string) => {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const parseTime = (value: string) => {
  if (!TIME_PATTERN.test(value)) {
    throw badRequest(`Invalid time value "${value}"`);
  }
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) {
    throw badRequest(`Invalid time value "${value}"`);
  }
  return { hours, minutes };
};

const uniqueSorted = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);
const uniqueSortedTimes = (values: string[]) =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b));

export const validateSchedule = (schedule: RoutineSchedule): RoutineSchedule => {
  if (!schedule || typeof schedule !== 'object') {
    throw badRequest('schedule is required');
  }

  switch (schedule.frequency) {
    case 'HOURLY_INTERVAL': {
      parseTime(schedule.anchorTime);
      if (!Number.isInteger(schedule.intervalHours) || schedule.intervalHours < 1 || schedule.intervalHours > 24) {
        throw badRequest('intervalHours must be an integer between 1 and 24');
      }
      return schedule;
    }
    case 'DAILY': {
      if (!schedule.times?.length) {
        throw badRequest('times is required');
      }
      return { ...schedule, times: uniqueSortedTimes(schedule.times.map((time) => parseTime(time) && time)) };
    }
    case 'WEEKLY': {
      if (!schedule.daysOfWeek?.length) {
        throw badRequest('daysOfWeek is required');
      }
      if (!schedule.times?.length) {
        throw badRequest('times is required');
      }
      const days = uniqueSorted(schedule.daysOfWeek);
      if (days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
        throw badRequest('daysOfWeek must use values 0-6');
      }
      return {
        ...schedule,
        daysOfWeek: days,
        times: uniqueSortedTimes(schedule.times.map((time) => parseTime(time) && time)),
      };
    }
    case 'MONTHLY': {
      if (!schedule.daysOfMonth?.length) {
        throw badRequest('daysOfMonth is required');
      }
      if (!schedule.times?.length) {
        throw badRequest('times is required');
      }
      const days = uniqueSorted(schedule.daysOfMonth);
      if (days.some((day) => !Number.isInteger(day) || day < 1 || day > 31)) {
        throw badRequest('daysOfMonth must use values 1-31');
      }
      return {
        ...schedule,
        daysOfMonth: days,
        times: uniqueSortedTimes(schedule.times.map((time) => parseTime(time) && time)),
      };
    }
    default:
      throw badRequest('Unsupported frequency');
  }
};

export const validateCreateRoutine = (input: CreateRoutineInput): CreateRoutineInput => {
  if (!input.title?.trim()) {
    throw badRequest('title is required');
  }
  if (!input.type) {
    throw badRequest('type is required');
  }
  if (!input.timezone?.trim()) {
    throw badRequest('timezone is required');
  }
  if (!isValidTimeZone(input.timezone)) {
    throw badRequest('timezone is invalid');
  }
  return {
    title: input.title.trim(),
    type: input.type,
    notes: input.notes?.trim() || undefined,
    timezone: input.timezone.trim(),
    schedule: validateSchedule(input.schedule),
  };
};

export const validateUpdateRoutine = (input: UpdateRoutineInput): UpdateRoutineInput => {
  const next: UpdateRoutineInput = { ...input };
  if (next.title !== undefined) {
    if (!next.title.trim()) {
      throw badRequest('title cannot be empty');
    }
    next.title = next.title.trim();
  }
  if (next.notes !== undefined) {
    next.notes = next.notes.trim() || undefined;
  }
  if (next.timezone !== undefined) {
    if (!next.timezone.trim() || !isValidTimeZone(next.timezone)) {
      throw badRequest('timezone is invalid');
    }
    next.timezone = next.timezone.trim();
  }
  if (next.schedule) {
    next.schedule = validateSchedule(next.schedule);
  }
  return next;
};

const formatInTimeZone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
  };
};

const getTimeZoneOffsetMs = (date: Date, timeZone: string) => {
  const parts = formatInTimeZone(date, timeZone);
  const utc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return utc - date.getTime();
};

const zonedDateTimeToUtc = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
) => {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
};

const addDaysUtc = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const addMonthsLocal = (date: Date, months: number, timeZone: string) => {
  const parts = formatInTimeZone(date, timeZone);
  const utc = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1, 12, 0, 0));
  return utc;
};

const getOccurrenceId = (routineId: string, scheduledFor: Date) =>
  `${routineId}:${scheduledFor.toISOString()}`;

export const generateOccurrencesForRoutine = (
  routine: RoutineDefinition,
  windowStart: Date,
  windowEnd: Date,
  anchorDate = routine.createdAt
): RoutineOccurrence[] => {
  const occurrences: RoutineOccurrence[] = [];
  const now = new Date();
  const createOccurrence = (scheduledFor: Date) => {
    if (scheduledFor < windowStart || scheduledFor > windowEnd) {
      return;
    }
    occurrences.push({
      occurrenceId: getOccurrenceId(routine.routineId, scheduledFor),
      routineId: routine.routineId,
      petId: routine.petId,
      scheduledFor,
      status:
        scheduledFor.getTime() < now.getTime()
          ? RoutineOccurrenceStatus.MISSED
          : RoutineOccurrenceStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    });
  };

  switch (routine.schedule.frequency) {
    case 'HOURLY_INTERVAL': {
      const { hours, minutes } = parseTime(routine.schedule.anchorTime);
      const anchorParts = formatInTimeZone(anchorDate, routine.timezone);
      let current = zonedDateTimeToUtc(
        anchorParts.year,
        anchorParts.month,
        anchorParts.day,
        hours,
        minutes,
        routine.timezone
      );
      while (current < windowStart) {
        current = new Date(
          current.getTime() + routine.schedule.intervalHours * 60 * 60 * 1000
        );
      }
      while (current <= windowEnd) {
        createOccurrence(current);
        current = new Date(
          current.getTime() + routine.schedule.intervalHours * 60 * 60 * 1000
        );
      }
      break;
    }
    case 'DAILY': {
      for (let cursor = windowStart; cursor <= windowEnd; cursor = addDaysUtc(cursor, 1)) {
        const parts = formatInTimeZone(cursor, routine.timezone);
        for (const time of routine.schedule.times) {
          const { hours, minutes } = parseTime(time);
          createOccurrence(
            zonedDateTimeToUtc(
              parts.year,
              parts.month,
              parts.day,
              hours,
              minutes,
              routine.timezone
            )
          );
        }
      }
      break;
    }
    case 'WEEKLY': {
      for (let cursor = windowStart; cursor <= windowEnd; cursor = addDaysUtc(cursor, 1)) {
        const parts = formatInTimeZone(cursor, routine.timezone);
        const weekday = new Date(
          Date.UTC(parts.year, parts.month - 1, parts.day)
        ).getUTCDay();
        if (!routine.schedule.daysOfWeek.includes(weekday)) {
          continue;
        }
        for (const time of routine.schedule.times) {
          const { hours, minutes } = parseTime(time);
          createOccurrence(
            zonedDateTimeToUtc(
              parts.year,
              parts.month,
              parts.day,
              hours,
              minutes,
              routine.timezone
            )
          );
        }
      }
      break;
    }
    case 'MONTHLY': {
      for (let cursor = addMonthsLocal(windowStart, -1, routine.timezone);
        cursor <= addMonthsLocal(windowEnd, 1, routine.timezone);
        cursor = addMonthsLocal(cursor, 1, routine.timezone)) {
        const parts = formatInTimeZone(cursor, routine.timezone);
        for (const day of routine.schedule.daysOfMonth) {
          const monthLastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
          if (day > monthLastDay) {
            continue;
          }
          for (const time of routine.schedule.times) {
            const { hours, minutes } = parseTime(time);
            createOccurrence(
              zonedDateTimeToUtc(
                parts.year,
                parts.month,
                day,
                hours,
                minutes,
                routine.timezone
              )
            );
          }
        }
      }
      break;
    }
  }

  return occurrences.sort(
    (left, right) => left.scheduledFor.getTime() - right.scheduledFor.getTime()
  );
};

export const listRoutinesForPet = async (petId: string) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: PETTZI_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': buildPetRoutinePk(petId),
        ':sk': 'ROUTINE#',
      },
    })
  );

  return (result.Items ?? [])
    .map(fromItemRoutineDefinition)
    .filter((routine) => routine.status !== RoutineStatus.ARCHIVED)
    .sort((left, right) => left.title.localeCompare(right.title));
};

export const getRoutineOrThrow = async (petId: string, routineId: string) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: PETTZI_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': buildPetRoutinePk(petId),
        ':sk': buildPetRoutineSk(routineId),
      },
    })
  );

  const item = result.Items?.[0];
  if (!item) {
    throw notFound('Routine not found');
  }

  const routine = fromItemRoutineDefinition(item);
  if (routine.status === RoutineStatus.ARCHIVED) {
    throw notFound('Routine not found');
  }
  return routine;
};

const listOccurrencesByPet = async (petId: string) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: PETTZI_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': buildPetRoutineOccurrencePk(petId),
        ':sk': 'ROUTINE_OCC#',
      },
    })
  );

  return (result.Items ?? []).map(fromItemRoutineOccurrence);
};

const putOccurrence = async (occurrence: RoutineOccurrence) =>
  docClient.send(
    new PutCommand({
      TableName: PETTZI_TABLE_NAME,
      Item: toItemRoutineOccurrence(occurrence),
    })
  );

export const syncPetRoutineOccurrences = async (petId: string) => {
  const routines = await listRoutinesForPet(petId);
  const occurrences = await listOccurrencesByPet(petId);
  const occurrenceMap = new Map(
    occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence])
  );
  const expectedIds = new Set<string>();
  const now = new Date();
  const { start, end } = getWindow(now);

  for (const routine of routines) {
    const generated =
      routine.status === RoutineStatus.ACTIVE
        ? generateOccurrencesForRoutine(routine, start, end)
        : [];

    for (const occurrence of generated) {
      expectedIds.add(occurrence.occurrenceId);
      const existing = occurrenceMap.get(occurrence.occurrenceId);
      if (existing) {
        if (
          existing.status === RoutineOccurrenceStatus.PENDING &&
          existing.scheduledFor.getTime() < now.getTime()
        ) {
          await putOccurrence({
            ...existing,
            status: RoutineOccurrenceStatus.MISSED,
            updatedAt: now,
          });
        }
        continue;
      }
      await putOccurrence(occurrence);
    }
  }

  for (const occurrence of occurrences) {
    const isFuture = occurrence.scheduledFor.getTime() > now.getTime();
    const outsideWindow =
      occurrence.scheduledFor.getTime() < start.getTime() ||
      occurrence.scheduledFor.getTime() > end.getTime();
    if (!expectedIds.has(occurrence.occurrenceId) && (outsideWindow || isFuture)) {
      await docClient.send(
        new DeleteCommand({
          TableName: PETTZI_TABLE_NAME,
          Key: {
            PK: buildPetRoutineOccurrencePk(occurrence.petId),
            SK: toItemRoutineOccurrence(occurrence).SK,
          },
        })
      );
    }
  }

  return { routines: await listRoutinesForPet(petId), occurrences: await listOccurrencesByPet(petId) };
};

export const listUpcomingForPet = async (
  petId: string
): Promise<RoutineOccurrenceExpanded[]> => {
  const synced = await syncPetRoutineOccurrences(petId);
  const routineMap = new Map(
    synced.routines.map((routine) => [routine.routineId, routine])
  );
  return synced.occurrences
    .filter((occurrence) => occurrence.status === RoutineOccurrenceStatus.PENDING)
    .filter((occurrence) => occurrence.scheduledFor.getTime() >= Date.now())
    .sort((left, right) => left.scheduledFor.getTime() - right.scheduledFor.getTime())
    .map((occurrence) => ({
      ...occurrence,
      routine: routineMap.get(occurrence.routineId)!,
    }))
    .filter((occurrence) => Boolean(occurrence.routine));
};

export const listHistoryForPet = async (
  petId: string
): Promise<RoutineOccurrenceExpanded[]> => {
  const synced = await syncPetRoutineOccurrences(petId);
  const routineMap = new Map(
    synced.routines.map((routine) => [routine.routineId, routine])
  );
  return synced.occurrences
    .filter((occurrence) => occurrence.status !== RoutineOccurrenceStatus.PENDING)
    .sort((left, right) => right.scheduledFor.getTime() - left.scheduledFor.getTime())
    .map((occurrence) => ({
      ...occurrence,
      routine: routineMap.get(occurrence.routineId)!,
    }))
    .filter((occurrence) => Boolean(occurrence.routine));
};

export const listOccurrencesForRoutine = async (
  petId: string,
  routineId: string
) => {
  await getRoutineOrThrow(petId, routineId);
  const synced = await syncPetRoutineOccurrences(petId);
  return synced.occurrences
    .filter((occurrence) => occurrence.routineId === routineId)
    .sort((left, right) => left.scheduledFor.getTime() - right.scheduledFor.getTime());
};

export const saveRoutine = async (routine: RoutineDefinition) => {
  await docClient.send(
    new PutCommand({
      TableName: PETTZI_TABLE_NAME,
      Item: toItemRoutineDefinition(routine),
    })
  );
  return routine;
};

export const deleteRoutineAndOccurrences = async (petId: string, routineId: string) => {
  const synced = await syncPetRoutineOccurrences(petId);
  const occurrenceDeletes = synced.occurrences
    .filter((occurrence) => occurrence.routineId === routineId)
    .map((occurrence) =>
      docClient.send(
        new DeleteCommand({
          TableName: PETTZI_TABLE_NAME,
          Key: {
            PK: buildPetRoutineOccurrencePk(occurrence.petId),
            SK: toItemRoutineOccurrence(occurrence).SK,
          },
        })
      )
    );

  await Promise.all(occurrenceDeletes);
  await docClient.send(
    new DeleteCommand({
      TableName: PETTZI_TABLE_NAME,
      Key: {
        PK: buildPetRoutinePk(petId),
        SK: buildPetRoutineSk(routineId),
      },
    })
  );
};

export const updateOccurrenceStatus = async (
  petId: string,
  occurrenceId: string,
  status: RoutineOccurrenceStatus.COMPLETED | RoutineOccurrenceStatus.SKIPPED,
  completedByUserId: string,
  notes?: string
) => {
  const synced = await syncPetRoutineOccurrences(petId);
  const occurrence = synced.occurrences.find(
    (item) => item.occurrenceId === occurrenceId
  );
  if (!occurrence) {
    throw notFound('Occurrence not found');
  }

  const routine = synced.routines.find((item) => item.routineId === occurrence.routineId);
  if (!routine || routine.status === RoutineStatus.ARCHIVED) {
    throw notFound('Occurrence not found');
  }
  if (occurrence.status !== RoutineOccurrenceStatus.PENDING) {
    throw badRequest('Only pending occurrences can be updated');
  }

  const now = new Date();
  const updated: RoutineOccurrence = {
    ...occurrence,
    status,
    completedAt:
      status === RoutineOccurrenceStatus.COMPLETED ? now : occurrence.completedAt,
    skippedAt:
      status === RoutineOccurrenceStatus.SKIPPED ? now : occurrence.skippedAt,
    notes: notes?.trim() || occurrence.notes,
    completedByUserId,
    updatedAt: now,
  };
  await putOccurrence(updated);
  return updated;
};
