import type { ErrorCode, ServiceError } from "../types";

export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ServiceError {
  return details ? { code, details, message } : { code, message };
}

export class ServiceException extends Error {
  readonly error: ServiceError;

  constructor(error: ServiceError) {
    super(error.message);
    this.name = "ServiceException";
    this.error = error;
  }
}
