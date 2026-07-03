import { TRPCError } from "@trpc/server";
import type {
  ErrorCode,
  Result,
  ServiceError,
} from "@campus-chat/services/types";

type TRPCErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR"
  | "NOT_FOUND"
  | "PRECONDITION_FAILED"
  | "TOO_MANY_REQUESTS"
  | "UNAUTHORIZED";

const errorCodeMap: Record<ErrorCode, TRPCErrorCode> = {
  ADMIN_INACTIVE: "FORBIDDEN",
  ADMIN_NOT_FOUND: "NOT_FOUND",
  BAN_ACTIVE: "FORBIDDEN",
  DISPLAY_NAME_INVALID: "BAD_REQUEST",
  GEOFENCE_NOT_CONFIGURED: "INTERNAL_SERVER_ERROR",
  INTERNAL_ERROR: "INTERNAL_SERVER_ERROR",
  INVALID_REPLY_TARGET: "BAD_REQUEST",
  INVALID_TOKEN: "UNAUTHORIZED",
  LOCATION_OUTSIDE_GEOFENCE: "FORBIDDEN",
  MEDIA_NOT_FOUND: "NOT_FOUND",
  MESSAGE_EMPTY: "BAD_REQUEST",
  MESSAGE_NOT_FOUND: "NOT_FOUND",
  MESSAGE_TOO_LONG: "BAD_REQUEST",
  NOT_ROOM_PARTICIPANT: "FORBIDDEN",
  RATE_LIMITED: "TOO_MANY_REQUESTS",
  REPORT_NOT_FOUND: "NOT_FOUND",
  ROOM_ARCHIVED: "PRECONDITION_FAILED",
  ROOM_BANNED: "FORBIDDEN",
  ROOM_EXPIRED: "PRECONDITION_FAILED",
  ROOM_FULL: "PRECONDITION_FAILED",
  ROOM_LOCKED: "PRECONDITION_FAILED",
  ROOM_NOT_FOUND: "NOT_FOUND",
  SESSION_NOT_FOUND: "UNAUTHORIZED",
  SESSION_REVOKED: "UNAUTHORIZED",
  USER_NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "BAD_REQUEST",
};

export class ServiceErrorCause extends Error {
  readonly serviceError: ServiceError;

  constructor(serviceError: ServiceError) {
    super(serviceError.message);
    this.name = "ServiceErrorCause";
    this.serviceError = serviceError;
  }
}

export function mapServiceErrorToTRPCError(error: ServiceError): TRPCError {
  return new TRPCError({
    cause: new ServiceErrorCause(error),
    code: errorCodeMap[error.code] ?? "INTERNAL_SERVER_ERROR",
    message: error.message,
  });
}

export function handleServiceResult<T>(result: Result<T>): T {
  if (!result.ok) {
    throw mapServiceErrorToTRPCError(result.error);
  }

  return result.value;
}

export function isServiceErrorCause(
  cause: unknown,
): cause is ServiceErrorCause {
  return cause instanceof ServiceErrorCause;
}
