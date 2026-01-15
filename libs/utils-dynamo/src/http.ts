/**
 * Common HTTP response helpers for API Gateway HTTP API (v2).
 * These helpers return plain objects compatible with APIGatewayProxyResultV2.
 */

export interface ErrorBody {
    error: {
      code: string;
      message: string;
      details?: unknown;
    };
  }
  
export interface ApiResponse<T = unknown> {
    statusCode: number;
    headers?: Record<string, string>;
    body?: string;
    cookies?: string[];
  }
  
  /**
   * Internal helper to build JSON responses with default headers.
   */
  const jsonResponse = <T>(
    statusCode: number,
    body: T,
    extraHeaders?: Record<string, string>,
    cookies?: string[],
  ): ApiResponse<T> => ({
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
    },
    ...(cookies && cookies.length ? { cookies } : {}),
    body: JSON.stringify(body),
  });
  
  /**
   * 2xx helpers
   * ------------------------------------------------------------------ */
  
export const ok = <T>(
  body: T,
  headers?: Record<string, string>,
  cookies?: string[]
): ApiResponse<T> => jsonResponse(200, body, headers, cookies);
  
export const created = <T>(
  body: T,
  headers?: Record<string, string>,
  cookies?: string[]
): ApiResponse<T> => jsonResponse(201, body, headers, cookies);
  
  /**
   * 204 No Content – usually no body.
   */
  export const noContent = (headers?: Record<string, string>): ApiResponse =>
    ({
      statusCode: 204,
      headers: {
        ...(headers ?? {}),
      },
    } satisfies ApiResponse);
  
  /**
   * 4xx helpers (error format)
   * ------------------------------------------------------------------ */
  
  const errorResponse = (
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
    headers?: Record<string, string>,
  ): ApiResponse<ErrorBody> =>
    jsonResponse(
      statusCode,
      {
        error: {
          code,
          message,
          ...(details !== undefined ? { details } : {}),
        },
      },
      headers,
    );
  
  export const badRequest = (
    message: string,
    details?: unknown,
    headers?: Record<string, string>,
  ): ApiResponse<ErrorBody> =>
    errorResponse(400, 'BAD_REQUEST', message, details, headers);
  
  export const unauthorized = (
    message = 'Unauthorized',
    details?: unknown,
    headers?: Record<string, string>,
  ): ApiResponse<ErrorBody> =>
    errorResponse(401, 'UNAUTHORIZED', message, details, headers);
  
  export const forbidden = (
    message = 'Forbidden',
    details?: unknown,
    headers?: Record<string, string>,
  ): ApiResponse<ErrorBody> =>
    errorResponse(403, 'FORBIDDEN', message, details, headers);
  
  export const notFound = (
    message = 'Not Found',
    details?: unknown,
    headers?: Record<string, string>,
  ): ApiResponse<ErrorBody> =>
    errorResponse(404, 'NOT_FOUND', message, details, headers);
  
  export const conflict = (
    message = 'Conflict',
    details?: unknown,
    headers?: Record<string, string>,
  ): ApiResponse<ErrorBody> =>
    errorResponse(409, 'CONFLICT', message, details, headers);
  
  /**
   * 5xx helper
   * ------------------------------------------------------------------ */
  
  export const serverError = (
    message = 'Internal server error',
    details?: unknown,
    headers?: Record<string, string>,
  ): ApiResponse<ErrorBody> =>
    errorResponse(500, 'INTERNAL_ERROR', message, details, headers);
