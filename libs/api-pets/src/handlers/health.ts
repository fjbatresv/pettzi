import { QueryCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { buildPetEventPk } from '@pettzi/domain-model';
import { Pet } from '@pettzi/domain-model';

type VaccineStatus = {
  hasData: boolean;
  hasExpired: boolean;
};

const EVENT_PREFIX = 'EVENT#';
const VACCINE_EVENT_TYPE = 'VACCINE';

const parseDate = (value: Date | string | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const fetchVaccineStatus = async (
  docClient: DynamoDBDocumentClient,
  tableName: string,
  petId: string
): Promise<VaccineStatus> => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      FilterExpression: 'eventType = :eventType',
      ExpressionAttributeValues: {
        ':pk': buildPetEventPk(petId),
        ':sk': EVENT_PREFIX,
        ':eventType': VACCINE_EVENT_TYPE,
      },
    })
  );

  const items = result.Items ?? [];
  if (items.length === 0) {
    return { hasData: false, hasExpired: false };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let hasData = false;
  for (const item of items) {
    const meta = (item.metadata ?? {}) as Record<string, unknown>;
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

export const computeHealthIndex = (
  pet: Pet,
  vaccineStatus: VaccineStatus
): { healthIndex?: number } => {
  let score = 0;
  let hasData = false;
  const now = new Date();

  const groomingDate = parseDate(pet.lastGroomingDate);
  if (groomingDate) {
    hasData = true;
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    if (groomingDate.getTime() >= threeMonthsAgo.getTime()) {
      score += 1;
    }
  }

  const vetDate = parseDate(pet.lastVetVisitDate);
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
