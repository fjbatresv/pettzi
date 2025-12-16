import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from './delete-file.handler';

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  const send = jest.fn();
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send }) },
    __sendMock: send,
  };
});

jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn();
  return {
    S3Client: jest.fn(() => ({ send })),
    DeleteObjectCommand: jest.fn((input) => input),
    __s3SendMock: send,
  };
});

const { __sendMock: ddbSendMock } = jest.requireMock(
  '@aws-sdk/lib-dynamodb'
) as {
  __sendMock: jest.Mock;
};
const { __s3SendMock: s3SendMock } = jest.requireMock('@aws-sdk/client-s3') as {
  __s3SendMock: jest.Mock;
};

describe('delete-file.handler', () => {
  const baseEvent = {
    version: '2.0',
    routeKey: '',
    rawPath: '',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '',
      apiId: '',
      domainName: '',
      domainPrefix: '',
      http: {
        method: 'DELETE',
        path: '/pets/pet-1/uploads/fileKey',
        protocol: 'HTTP/1.1',
        sourceIp: '',
        userAgent: '',
      },
      requestId: '',
      routeKey: '',
      stage: '$default',
      time: '',
      timeEpoch: 0,
      authorizer: {
        jwt: { claims: { sub: 'owner-1' }, scopes: [] },
      },
    },
    isBase64Encoded: false,
  } as APIGatewayProxyEventV2;

  beforeEach(() => {
    process.env.PETTZI_TABLE_NAME = 'PettziTable';
    process.env.PETTZI_DOCS_BUCKET_NAME = 'docs-bucket';
    ddbSendMock.mockReset();
    s3SendMock.mockReset();
  });

  it('deletes a file', async () => {
    ddbSendMock.mockResolvedValue({
      Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' },
    });
    s3SendMock.mockResolvedValue({});

    const res = await (handler as any)({
      ...baseEvent,
      pathParameters: {
        petId: 'pet-1',
        fileKey: encodeURIComponent('pets/pet-1/photos/file1.jpg'),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.message).toMatch(/deleted/i);
  });

  it('rejects file outside pet', async () => {
    const res = await (handler as any)({
      ...baseEvent,
      pathParameters: {
        petId: 'pet-1',
        fileKey: encodeURIComponent('pets/other/photos/file1.jpg'),
      },
    });
    expect(res.statusCode).toBe(401);
  });
});
