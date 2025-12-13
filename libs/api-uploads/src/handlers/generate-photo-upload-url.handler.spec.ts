import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from './generate-photo-upload-url.handler';

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
    PutObjectCommand: jest.fn((input) => input),
    __s3SendMock: send,
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url'),
}));

const { __sendMock: ddbSendMock } = jest.requireMock('@aws-sdk/lib-dynamodb') as {
  __sendMock: jest.Mock;
};

describe('generate-photo-upload-url.handler', () => {
  const baseEvent: APIGatewayProxyEventV2 = {
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
        method: 'POST',
        path: '/pets/pet-1/uploads/photo',
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
  };

  beforeEach(() => {
    process.env.PETTZI_TABLE_NAME = 'PettziTable';
    process.env.PETTZI_DOCS_BUCKET_NAME = 'docs-bucket';
    ddbSendMock.mockReset();
  });

  it('returns a presigned upload URL', async () => {
    ddbSendMock.mockResolvedValue({ Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } });

    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1' },
      body: JSON.stringify({ contentType: 'image/png' }),
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.uploadUrl).toContain('https://signed-url');
    expect(body.fileKey).toContain('pets/pet-1/photos/');
  });

  it('returns unauthorized when not owner', async () => {
    ddbSendMock.mockResolvedValue({});
    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1' },
      body: '{}',
    });
    expect(res.statusCode).toBe(401);
  });
});
