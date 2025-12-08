import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from './generate-download-url.handler';

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
    GetObjectCommand: jest.fn((input) => input),
    __s3SendMock: send,
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://download-url'),
}));

const { __sendMock: ddbSendMock } = jest.requireMock('@aws-sdk/lib-dynamodb') as {
  __sendMock: jest.Mock;
};

describe('generate-download-url.handler', () => {
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
        method: 'GET',
        path: '/pets/pet-1/uploads/file-1/download-url',
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
    process.env.PETO_TABLE_NAME = 'PetoTable';
    process.env.PETO_DOCS_BUCKET_NAME = 'docs-bucket';
    ddbSendMock.mockReset();
  });

  it('returns a download url', async () => {
    ddbSendMock.mockResolvedValue({ Item: { PK: 'PET#pet-1', SK: 'OWNER#owner-1' } });

    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1', fileKey: encodeURIComponent('pets/pet-1/photos/file1.jpg') },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body ?? '{}');
    expect(body.downloadUrl).toContain('https://download-url');
  });

  it('rejects fileKey outside pet', async () => {
    const res = await handler({
      ...baseEvent,
      pathParameters: { petId: 'pet-1', fileKey: encodeURIComponent('pets/other/photos/file1.jpg') },
    });
    expect(res.statusCode).toBe(401);
  });
});
