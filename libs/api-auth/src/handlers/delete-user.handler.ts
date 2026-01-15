import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  BatchWriteCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  S3Client,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { ok, serverError } from '@pettzi/utils-dynamo/http';
import {
  buildOwnerProfilePk,
  buildPetOwnerGsi1Pk,
  buildPetOwnerPk,
  buildPetOwnerSk,
  buildPetPkKey,
  buildUserAccountPk,
} from '@pettzi/domain-model';
import { clearRefreshCookie } from './cookies';
import {
  docClient,
  getClaims,
  getEmail,
  getOwnerId,
  PETTZI_TABLE_NAME,
} from './common';

const cognito = new CognitoIdentityProviderClient({});
const s3 = new S3Client({});
const DOCS_BUCKET = process.env.PETTZI_DOCS_BUCKET_NAME ?? '';
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? '';
const GSI1 = 'GSI1';

interface PetOwnerLink {
  petId?: string;
  role?: string;
}

const chunk = <T>(items: T[], size: number) => {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

const deleteKeys = async (keys: Array<{ PK: string; SK: string }>) => {
  if (keys.length === 0) {
    return;
  }

  for (const batch of chunk(keys, 25)) {
    let pending = batch;
    for (let attempt = 0; attempt < 3 && pending.length > 0; attempt += 1) {
      const response = await docClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [PETTZI_TABLE_NAME]: pending.map((key) => ({
              DeleteRequest: { Key: key },
            })),
          },
        })
      );
      const unprocessed =
        response.UnprocessedItems?.[PETTZI_TABLE_NAME]?.map(
          (item) => item.DeleteRequest?.Key as { PK: string; SK: string }
        ) ?? [];
      pending = unprocessed;
    }
  }
};

const collectKeysByPk = async (pk: string) => {
  const keys: Array<{ PK: string; SK: string }> = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: PETTZI_TABLE_NAME,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': pk,
        },
        ExclusiveStartKey: lastKey,
      })
    );
    (result.Items ?? []).forEach((item) => {
      if (item?.PK && item?.SK) {
        keys.push({ PK: item.PK, SK: item.SK });
      }
    });
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return keys;
};

const deleteByPk = async (pk: string) => {
  const keys = await collectKeysByPk(pk);
  await deleteKeys(keys);
};

const listOwnerLinks = async (ownerId: string) => {
  const links: PetOwnerLink[] = [];
  let lastKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: PETTZI_TABLE_NAME,
        IndexName: GSI1,
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': buildPetOwnerGsi1Pk(ownerId),
        },
        ExclusiveStartKey: lastKey,
      })
    );
    (result.Items ?? []).forEach((item) => {
      links.push({
        petId: item.petId as string | undefined,
        role: item.role as string | undefined,
      });
    });
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return links;
};

const deletePetFiles = async (petId: string) => {
  if (!DOCS_BUCKET) {
    return;
  }

  let continuationToken: string | undefined;
  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: DOCS_BUCKET,
        Prefix: `pets/${petId}/`,
        ContinuationToken: continuationToken,
      })
    );

    const keys =
      response.Contents?.map((obj) => obj.Key).filter(Boolean) ?? [];
    if (keys.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: DOCS_BUCKET,
          Delete: {
            Objects: keys.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      );
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);
};

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  let ownerId: string;
  try {
    ownerId = getOwnerId(event);
  } catch (err: any) {
    return err;
  }

  const claims = getClaims(event);
  const email = getEmail(event);
  const username =
    claims['cognito:username'] || claims.username || email || ownerId;
  console.info('Delete account request', {
    ownerId,
    username,
    hasEmail: Boolean(email),
  });

  try {
    const links = await listOwnerLinks(ownerId);
    console.info('Delete account pets', {
      ownerId,
      totalLinks: links.length,
      primaryPets: links.filter((link) => !link.role || link.role === 'PRIMARY').length,
    });

    for (const link of links) {
      const petId = link.petId;
      if (!petId) {
        continue;
      }

      if (!link.role || link.role === 'PRIMARY') {
        console.info('Deleting primary pet', { ownerId, petId });
        await deleteByPk(buildPetPkKey(petId));
        await deletePetFiles(petId);
      } else {
        console.info('Deleting secondary owner link', { ownerId, petId });
        await deleteKeys([
          {
            PK: buildPetOwnerPk(petId),
            SK: buildPetOwnerSk(ownerId),
          },
        ]);
      }
    }

    console.info('Deleting owner profile records', { ownerId });
    await deleteByPk(buildOwnerProfilePk(ownerId));
    console.info('Deleting user account records', { ownerId });
    await deleteByPk(buildUserAccountPk(ownerId));

    if (USER_POOL_ID && username) {
      console.info('Deleting Cognito user', { ownerId, username });
      await cognito.send(
        new AdminDeleteUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: username,
        })
      );
      console.info('Cognito user deleted', { ownerId, username });
    } else {
      console.warn('Skipping Cognito delete; missing config', {
        ownerId,
        hasUserPoolId: Boolean(USER_POOL_ID),
        hasUsername: Boolean(username),
      });
    }

    return ok(
      { message: 'Account deleted' },
      undefined,
      [clearRefreshCookie()]
    );
  } catch (error) {
    console.error('Delete user error', error);
    return serverError('Failed to delete user');
  }
};
