import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { badRequest, notFound } from '@pettzi/utils-dynamo/http';
import {
  buildPetRoutineActivityPk,
  buildPetRoutineActivitySk,
  buildPetRoutineOccurrencePk,
  buildPetRoutinePk,
  buildPetRoutineSk,
  fromItemPetRoutine,
  fromItemRoutineActivity,
  fromItemRoutineOccurrence,
  PetRoutine,
  RoutineActivity,
  RoutineOccurrence,
  RoutineOccurrenceStatus,
  RoutineSchedule,
  RoutineStatus,
  RoutineType,
  toItemPetRoutine,
  toItemRoutineActivity,
  toItemRoutineOccurrence,
} from '@pettzi/domain-model';
import { docClient, PETTZI_TABLE_NAME } from '../handlers/common';

const PAST_WINDOW_DAYS = 14;
const FUTURE_WINDOW_DAYS = 30;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export interface RoutineOccurrenceExpanded extends RoutineOccurrence {
  activity: RoutineActivity;
  routine: PetRoutine;
}

export interface RoutineDetail {
  routine: PetRoutine | null;
  activities: RoutineActivity[];
}

export interface UpsertRoutineInput {
  timezone: string;
  status?: RoutineStatus;
}

export interface CreateRoutineActivityInput {
  title: string;
  type: RoutineType;
  notes?: string;
  status?: RoutineStatus.ACTIVE | RoutineStatus.PAUSED;
  routineTimezone?: string;
  schedule: RoutineSchedule;
}

export interface UpdateRoutineActivityInput {
  title?: string;
  type?: RoutineType;
  notes?: string;
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
    case 'DAILY': {
      if (!schedule.times?.length) {
        throw badRequest('times is required');
      }
      return {
        ...schedule,
        times: uniqueSortedTimes(schedule.times.map((time) => parseTime(time) && time)),
      };
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

export const validateUpsertRoutine = (input: UpsertRoutineInput): UpsertRoutineInput => {
  if (!input.timezone?.trim()) {
    throw badRequest('timezone is required');
  }
  if (!isValidTimeZone(input.timezone.trim())) {
    throw badRequest('timezone is invalid');
  }
  return {
    timezone: input.timezone.trim(),
    status: input.status ?? RoutineStatus.ACTIVE,
  };
};

export const validateCreateRoutineActivity = (
  input: CreateRoutineActivityInput
): CreateRoutineActivityInput => {
  if (!input.title?.trim()) {
    throw badRequest('title is required');
  }
  if (!input.type) {
    throw badRequest('type is required');
  }
  if (input.routineTimezone !== undefined) {
    if (!input.routineTimezone.trim() || !isValidTimeZone(input.routineTimezone.trim())) {
      throw badRequest('routineTimezone is invalid');
    }
  }

  return {
    title: input.title.trim(),
    type: input.type,
    notes: input.notes?.trim() || undefined,
    status: input.status ?? RoutineStatus.ACTIVE,
    routineTimezone: input.routineTimezone?.trim() || undefined,
    schedule: validateSchedule(input.schedule),
  };
};

export const validateUpdateRoutineActivity = (
  input: UpdateRoutineActivityInput
): UpdateRoutineActivityInput => {
  const next: UpdateRoutineActivityInput = { ...input };
  if (next.title !== undefined) {
    if (!next.title.trim()) {
      throw badRequest('title cannot be empty');
    }
    next.title = next.title.trim();
  }
  if (next.notes !== undefined) {
    next.notes = next.notes.trim() || undefined;
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
  return new Date(Date.UTC(parts.year, parts.month - 1 + months, 1, 12, 0, 0));
};

const isSameLocalDate = (left: Date, right: Date, timeZone: string) => {
  const a = formatInTimeZone(left, timeZone);
  const b = formatInTimeZone(right, timeZone);
  return a.year === b.year && a.month === b.month && a.day === b.day;
};

const getOccurrenceId = (activityId: string, scheduledFor: Date) =>
  `${activityId}:${scheduledFor.toISOString()}`;

const assertRoutineMutable = (routine: PetRoutine | null) => {
  if (routine?.status === RoutineStatus.ARCHIVED) {
    throw badRequest('Archived routines cannot be modified');
  }
};

export const generateOccurrencesForActivity = (
  routine: PetRoutine,
  activity: RoutineActivity,
  windowStart: Date,
  windowEnd: Date
): RoutineOccurrence[] => {
  const occurrences: RoutineOccurrence[] = [];
  const now = new Date();
  const createOccurrence = (scheduledFor: Date) => {
    if (scheduledFor < windowStart || scheduledFor > windowEnd) {
      return;
    }
    occurrences.push({
      occurrenceId: getOccurrenceId(activity.activityId, scheduledFor),
      routineId: routine.routineId,
      activityId: activity.activityId,
      petId: activity.petId,
      scheduledFor,
      status:
        scheduledFor.getTime() < now.getTime()
          ? RoutineOccurrenceStatus.MISSED
          : RoutineOccurrenceStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    });
  };

  switch (activity.schedule.frequency) {
    case 'DAILY': {
      for (let cursor = windowStart; cursor <= windowEnd; cursor = addDaysUtc(cursor, 1)) {
        const parts = formatInTimeZone(cursor, routine.timezone);
        for (const time of activity.schedule.times) {
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
        const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
        if (!activity.schedule.daysOfWeek.includes(weekday)) {
          continue;
        }
        for (const time of activity.schedule.times) {
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
      for (
        let cursor = addMonthsLocal(windowStart, -1, routine.timezone);
        cursor <= addMonthsLocal(windowEnd, 1, routine.timezone);
        cursor = addMonthsLocal(cursor, 1, routine.timezone)
      ) {
        const parts = formatInTimeZone(cursor, routine.timezone);
        for (const day of activity.schedule.daysOfMonth) {
          const monthLastDay = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
          if (day > monthLastDay) {
            continue;
          }
          for (const time of activity.schedule.times) {
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

export const getPetRoutine = async (petId: string): Promise<PetRoutine | null> => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: PETTZI_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': buildPetRoutinePk(petId),
        ':sk': buildPetRoutineSk(petId),
      },
    })
  );

  return result.Items?.[0] ? fromItemPetRoutine(result.Items[0]) : null;
};

export const listRoutineActivities = async (petId: string) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: PETTZI_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': buildPetRoutineActivityPk(petId),
        ':sk': 'ROUTINE_ACTIVITY#',
      },
    })
  );

  return (result.Items ?? [])
    .map(fromItemRoutineActivity)
    .filter((activity) => activity.status !== RoutineStatus.ARCHIVED)
    .sort((left, right) => left.title.localeCompare(right.title));
};

export const getRoutineActivityOrThrow = async (petId: string, activityId: string) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: PETTZI_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': buildPetRoutineActivityPk(petId),
        ':sk': buildPetRoutineActivitySk(activityId),
      },
    })
  );

  const item = result.Items?.[0];
  if (!item) {
    throw notFound('Routine activity not found');
  }

  const activity = fromItemRoutineActivity(item);
  if (activity.status === RoutineStatus.ARCHIVED) {
    throw notFound('Routine activity not found');
  }
  return activity;
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

export const ensurePetRoutine = async (
  petId: string,
  ownerUserId: string,
  timezone: string
) => {
  const existing = await getPetRoutine(petId);
  if (existing) {
    return existing;
  }

  const now = new Date();
  const routine: PetRoutine = {
    routineId: petId,
    petId,
    ownerUserId,
    timezone,
    status: RoutineStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  };
  await docClient.send(
    new PutCommand({
      TableName: PETTZI_TABLE_NAME,
      Item: toItemPetRoutine(routine),
    })
  );
  return routine;
};

export const savePetRoutine = async (routine: PetRoutine) => {
  await docClient.send(
    new PutCommand({
      TableName: PETTZI_TABLE_NAME,
      Item: toItemPetRoutine(routine),
    })
  );
  return routine;
};

export const saveRoutineActivity = async (activity: RoutineActivity) => {
  await docClient.send(
    new PutCommand({
      TableName: PETTZI_TABLE_NAME,
      Item: toItemRoutineActivity(activity),
    })
  );
  return activity;
};

export const getRoutineDetail = async (petId: string): Promise<RoutineDetail> => ({
  routine: await getPetRoutine(petId),
  activities: await listRoutineActivities(petId),
});

export const syncPetRoutineOccurrences = async (petId: string) => {
  const routine = await getPetRoutine(petId);
  const activities = await listRoutineActivities(petId);
  const occurrences = await listOccurrencesByPet(petId);
  const occurrenceMap = new Map(
    occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence])
  );
  const expectedIds = new Set<string>();
  const now = new Date();
  const { start, end } = getWindow(now);

  if (routine && routine.status === RoutineStatus.ACTIVE) {
    for (const activity of activities.filter((item) => item.status === RoutineStatus.ACTIVE)) {
      const generated = generateOccurrencesForActivity(routine, activity, start, end);
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
  }

  for (const occurrence of occurrences) {
    const isFuture = occurrence.scheduledFor.getTime() > now.getTime();
    const outsideWindow =
      occurrence.scheduledFor.getTime() < start.getTime() ||
      occurrence.scheduledFor.getTime() > end.getTime();
    const shouldDeletePending =
      occurrence.status === RoutineOccurrenceStatus.PENDING &&
      (!expectedIds.has(occurrence.occurrenceId) || outsideWindow || isFuture);
    const shouldDeleteOutsideWindow =
      !expectedIds.has(occurrence.occurrenceId) &&
      outsideWindow &&
      occurrence.status !== RoutineOccurrenceStatus.PENDING;

    if (shouldDeletePending || shouldDeleteOutsideWindow) {
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

  return {
    routine: await getPetRoutine(petId),
    activities: await listRoutineActivities(petId),
    occurrences: await listOccurrencesByPet(petId),
  };
};

export const listTodayForPet = async (
  petId: string
): Promise<RoutineOccurrenceExpanded[]> => {
  const synced = await syncPetRoutineOccurrences(petId);
  if (!synced.routine) {
    return [];
  }

  const activityMap = new Map(
    synced.activities.map((activity) => [activity.activityId, activity])
  );
  const now = new Date();

  return synced.occurrences
    .filter((occurrence) => isSameLocalDate(occurrence.scheduledFor, now, synced.routine!.timezone))
    .map((occurrence) => ({
      ...occurrence,
      activity: activityMap.get(occurrence.activityId)!,
      routine: synced.routine!,
    }))
    .filter((occurrence) => Boolean(occurrence.activity))
    .sort((left, right) => left.scheduledFor.getTime() - right.scheduledFor.getTime());
};

export const listHistoryForPet = async (
  petId: string
): Promise<RoutineOccurrenceExpanded[]> => {
  const synced = await syncPetRoutineOccurrences(petId);
  if (!synced.routine) {
    return [];
  }

  const activityMap = new Map(
    synced.activities.map((activity) => [activity.activityId, activity])
  );

  return synced.occurrences
    .filter((occurrence) => occurrence.status !== RoutineOccurrenceStatus.PENDING)
    .map((occurrence) => ({
      ...occurrence,
      activity: activityMap.get(occurrence.activityId)!,
      routine: synced.routine!,
    }))
    .filter((occurrence) => Boolean(occurrence.activity))
    .sort((left, right) => right.scheduledFor.getTime() - left.scheduledFor.getTime());
};

export const upsertPetRoutine = async (
  petId: string,
  ownerUserId: string,
  input: UpsertRoutineInput
) => {
  const payload = validateUpsertRoutine(input);
  const existing = await getPetRoutine(petId);
  const now = new Date();
  const routine: PetRoutine = existing
    ? {
        ...existing,
        timezone: payload.timezone,
        status: payload.status ?? existing.status,
        updatedAt: now,
      }
    : {
        routineId: petId,
        petId,
        ownerUserId,
        timezone: payload.timezone,
        status: payload.status ?? RoutineStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
      };

  await savePetRoutine(routine);
  await syncPetRoutineOccurrences(petId);
  return routine;
};

export const createRoutineActivity = async (
  petId: string,
  ownerUserId: string,
  input: CreateRoutineActivityInput
) => {
  const payload = validateCreateRoutineActivity(input);
  const routine = await ensurePetRoutine(
    petId,
    ownerUserId,
    payload.routineTimezone ?? 'UTC'
  );
  assertRoutineMutable(routine);

  const now = new Date();
  const activity: RoutineActivity = {
    activityId: crypto.randomUUID(),
    routineId: routine.routineId,
    petId,
    ownerUserId,
    title: payload.title,
    type: payload.type,
    notes: payload.notes,
    status: payload.status ?? RoutineStatus.ACTIVE,
    schedule: payload.schedule,
    createdAt: now,
    updatedAt: now,
  };
  await saveRoutineActivity(activity);
  await syncPetRoutineOccurrences(petId);
  return activity;
};

export const updateRoutineActivity = async (
  petId: string,
  activityId: string,
  input: UpdateRoutineActivityInput
) => {
  const payload = validateUpdateRoutineActivity(input);
  const routine = await getPetRoutine(petId);
  assertRoutineMutable(routine);
  const current = await getRoutineActivityOrThrow(petId, activityId);

  const updated: RoutineActivity = {
    ...current,
    title: payload.title ?? current.title,
    type: payload.type ?? current.type,
    notes: payload.notes !== undefined ? payload.notes : current.notes,
    status: payload.status ?? current.status,
    schedule: payload.schedule ?? current.schedule,
    updatedAt: new Date(),
  };

  await saveRoutineActivity(updated);
  await syncPetRoutineOccurrences(petId);
  return updated;
};

export const deleteRoutineActivityAndOccurrences = async (
  petId: string,
  activityId: string
) => {
  const routine = await getPetRoutine(petId);
  assertRoutineMutable(routine);
  const activity = await getRoutineActivityOrThrow(petId, activityId);
  const synced = await syncPetRoutineOccurrences(petId);
  const occurrenceDeletes = synced.occurrences
    .filter((occurrence) => occurrence.activityId === activity.activityId)
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
        PK: buildPetRoutineActivityPk(petId),
        SK: buildPetRoutineActivitySk(activityId),
      },
    })
  );
  await syncPetRoutineOccurrences(petId);
};

export const updateOccurrenceStatus = async (
  petId: string,
  occurrenceId: string,
  status: RoutineOccurrenceStatus.COMPLETED | RoutineOccurrenceStatus.SKIPPED,
  completedByUserId: string,
  notes?: string
) => {
  const synced = await syncPetRoutineOccurrences(petId);
  const occurrence = synced.occurrences.find((item) => item.occurrenceId === occurrenceId);
  if (!occurrence) {
    throw notFound('Occurrence not found');
  }

  if (!synced.routine || synced.routine.status === RoutineStatus.ARCHIVED) {
    throw notFound('Occurrence not found');
  }
  const activity = synced.activities.find((item) => item.activityId === occurrence.activityId);
  if (!activity || activity.status === RoutineStatus.ARCHIVED) {
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
    skippedAt: status === RoutineOccurrenceStatus.SKIPPED ? now : occurrence.skippedAt,
    notes: notes?.trim() || occurrence.notes,
    completedByUserId,
    updatedAt: now,
  };
  await putOccurrence(updated);
  return updated;
};
