import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  DeleteCommand,
  QueryCommand,
  BatchWriteCommand,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ok, badRequest, notFound, serverError } from '@pettzi/utils-dynamo/http';
import {
  buildPetEventPk,
  buildPetReminderPk,
  buildPetPkKey,
  buildPetSkMetadata,
  fromItemPet,
  fromItemPetEvent,
} from '@pettzi/domain-model';
import { assertOwnership, docClient, getOwnerId, PETTZI_TABLE_NAME } from './common';

const EVENT_PREFIX = 'EVENT#';
const VACCINE_EVENT_TYPE = 'VACCINE';

const parseDate = (value?: Date | string) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const computeVaccineStatus = (events: ReturnType<typeof fromItemPetEvent>[]) => {
  const items = events.filter((event) => event.eventType === VACCINE_EVENT_TYPE);
  if (items.length === 0) {
    return { hasData: false, hasExpired: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let hasData = false;
  for (const event of items) {
    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const expiry = meta['expiryDate'];
    if (!expiry || typeof expiry !== 'string') {
      continue;
    }
    const expiryDate = new Date(expiry);
    if (Number.isNaN(expiryDate.getTime())) {
      continue;
    }
    hasData = true;
    expiryDate.setHours(0, 0, 0, 0);
    if (expiryDate.getTime() < today.getTime()) {
      return { hasData: true, hasExpired: true };
    }
  }

  return { hasData, hasExpired: false };
};

const computeHealthIndex = (
  pet: { lastGroomingDate?: Date | string | null; lastVetVisitDate?: Date | string | null },
  vaccineStatus: { hasData: boolean; hasExpired: boolean }
) => {
  let score = 0;
  let hasData = false;
  const now = new Date();

  const groomingDate = parseDate(pet.lastGroomingDate ?? undefined);
  if (groomingDate) {
    hasData = true;
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    if (groomingDate.getTime() >= threeMonthsAgo.getTime()) {
      score += 1;
    }
  }

  const vetDate = parseDate(pet.lastVetVisitDate ?? undefined);
  if (vetDate) {
    hasData = true;
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (vetDate.getTime() >= sixMonthsAgo.getTime()) {
      score += 2;
    }
  }

  if (vaccineStatus.hasData) {
    hasData = true;
    if (!vaccineStatus.hasExpired) {
      score += 2;
    }
  }

  if (!hasData) {
    return {};
  }

  return { healthIndex: Math.min(5, Math.max(0, score)) };
};

const getLatestByDate = (events: ReturnType<typeof fromItemPetEvent>[]) => {
  if (!events.length) {
    return null;
  }
  return events.reduce((latest, current) =>
    current.eventDate > latest.eventDate ? current : latest
  );
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const petId = event.pathParameters?.petId;
  const eventId = event.pathParameters?.eventId;
  if (!petId || !eventId) {
    return badRequest('petId and eventId are required');
  }

  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  try {
    await assertOwnership(petId, ownerId);

    const eventsRes = await docClient.send(
      new QueryCommand({
        TableName: PETTZI_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': buildPetEventPk(petId),
          ':sk': EVENT_PREFIX,
        },
      })
    );

    const items = eventsRes.Items ?? [];
    const targetItem = items.find((item) => item.eventId === eventId);
    if (!targetItem) {
      return notFound('Event not found');
    }
    const events = items.map((item) => fromItemPetEvent(item));
    const remainingEvents = events.filter((item) => item.eventId !== eventId);

    const petRes = await docClient.send(
      new GetCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: {
          PK: buildPetPkKey(petId),
          SK: buildPetSkMetadata(),
        },
      })
    );
    if (!petRes.Item) {
      return notFound('Pet not found');
    }
    const pet = fromItemPet(petRes.Item);

    // Delete event
    await docClient.send(
      new DeleteCommand({
        TableName: PETTZI_TABLE_NAME,
        Key: { PK: buildPetEventPk(petId), SK: targetItem.SK },
      })
    );

    // Remove related reminders for this event
    const reminders = await docClient.send(
      new QueryCommand({
        TableName: PETTZI_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': buildPetReminderPk(petId),
          ':sk': 'REMINDER#',
        },
      })
    );
    const toDelete = (reminders.Items ?? []).filter((r) => r.eventId === eventId);
    if (toDelete.length > 0) {
      await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [PETTZI_TABLE_NAME]: toDelete.map((r) => ({
              DeleteRequest: { Key: { PK: r.PK, SK: r.SK } },
            })),
          },
        })
      );
    }

    const latestGrooming = getLatestByDate(
      remainingEvents.filter((item) => item.eventType === 'GROOMING')
    );
    const latestVetVisit = getLatestByDate(
      remainingEvents.filter((item) => item.eventType === 'VET_VISIT')
    );
    const latestWeight = getLatestByDate(
      remainingEvents.filter((item) => item.eventType === 'WEIGHT')
    );

    const nextLastGrooming = latestGrooming?.eventDate ?? null;
    const nextLastVet = latestVetVisit?.eventDate ?? null;
    const weightMeta = (latestWeight?.metadata ?? {}) as Record<string, unknown>;
    const nextWeightKg =
      typeof weightMeta['weightKg'] === 'number' ? (weightMeta['weightKg'] as number) : null;

    const vaccineStatus = computeVaccineStatus(remainingEvents);
    const { healthIndex } = computeHealthIndex(
      {
        lastGroomingDate: nextLastGrooming,
        lastVetVisitDate: nextLastVet,
      },
      vaccineStatus
    );

    const updateExpressions: string[] = [];
    const removeExpressions: string[] = [];
    const expressionValues: Record<string, any> = {
      ':updatedAt': new Date().toISOString(),
    };
    const expressionNames: Record<string, string> = {};

    const setField = (attr: string, value: any) => {
      const key = `:${attr}`;
      expressionNames[`#${attr}`] = attr;
      expressionValues[key] = value;
      updateExpressions.push(`#${attr} = ${key}`);
    };
    const removeField = (attr: string) => {
      expressionNames[`#${attr}`] = attr;
      removeExpressions.push(`#${attr}`);
    };

    if (nextLastGrooming) {
      setField('lastGroomingDate', nextLastGrooming.toISOString());
    } else {
      removeField('lastGroomingDate');
    }
    if (nextLastVet) {
      setField('lastVetVisitDate', nextLastVet.toISOString());
    } else {
      removeField('lastVetVisitDate');
    }
    if (nextWeightKg !== null) {
      setField('weightKg', nextWeightKg);
    } else {
      removeField('weightKg');
    }
    if (healthIndex !== undefined) {
      setField('healthIndex', healthIndex);
    } else {
      removeField('healthIndex');
    }
    setField('updatedAt', expressionValues[':updatedAt']);

    const updateParts = [];
    if (updateExpressions.length) {
      updateParts.push(`SET ${updateExpressions.join(', ')}`);
    }
    if (removeExpressions.length) {
      updateParts.push(`REMOVE ${removeExpressions.join(', ')}`);
    }

    if (updateParts.length) {
      await docClient.send(
        new UpdateCommand({
          TableName: PETTZI_TABLE_NAME,
          Key: {
            PK: buildPetPkKey(petId),
            SK: buildPetSkMetadata(),
          },
          UpdateExpression: updateParts.join(' '),
          ExpressionAttributeNames: expressionNames,
          ExpressionAttributeValues: expressionValues,
        })
      );
    }

    return ok({ message: 'Event deleted' });
  } catch (error) {
    console.error('Delete event error', error);
    return serverError('Failed to delete event');
  }
};
