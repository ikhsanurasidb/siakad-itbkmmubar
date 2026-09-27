export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId: string;
  fieldErrors?: Record<string, string[]>;
  retryAfterSeconds?: number;
  details?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;
  readonly retryAfterSeconds?: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options: {
      cause?: unknown;
      details?: Record<string, unknown>;
      fieldErrors?: Record<string, string[]>;
      retryAfterSeconds?: number;
    } = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.details = options.details;
    this.fieldErrors = options.fieldErrors;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }

  toPayload(requestId: string): ApiErrorPayload {
    return {
      code: this.code,
      details: this.details,
      fieldErrors: this.fieldErrors,
      message: this.message,
      requestId,
      retryAfterSeconds: this.retryAfterSeconds,
    };
  }
}

export const getApiErrorPayload = (
  error: unknown,
  requestId: string
): ApiErrorPayload => {
  if (error instanceof ApiError) {
    return error.toPayload(requestId);
  }

  return {
    code: "INTERNAL_ERROR",
    message:
      "Terjadi kendala pada sistem. Sampaikan kode referensi kepada pengelola.",
    requestId,
  };
};
