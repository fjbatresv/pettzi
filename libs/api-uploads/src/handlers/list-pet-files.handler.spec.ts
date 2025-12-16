import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from './list-pet-files.handler';

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
    ListObjectsV2Command: jest.fn((input) => input),
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

describe('list-pet-files.handler', () => {
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
        method: 'GET',
        path: '/pets/pet-1/uploads',
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

  it('lists files for a pet', async () => {
    ddbSendMock.mockResolvedValue({
      Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' },
    });
    s3SendMock.mockResolvedValue({
      Contents: [
        {
          Key: 'pets/pet-1/photos/file1.jpg',
          Size: 123,
          LastModified: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    });

    const res = await (handler as any)({
      ...baseEvent,
      pathParameters: { petId: 'pet-1' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.files).toHaveLength(1);
    expect(body.files[0].type).toBe('PHOTO');
  });
});
