import { initTRPC, TRPCError } from "@trpc/server";
import type { AdminRole } from "@campus-chat/services/types";
import { SessionService } from "@campus-chat/services/services";
import { hashToken } from "@campus-chat/services/utils";
import superjson from "superjson";

import { AdminSessionManager } from "./admin-session";
import type { AdminContext, AuthenticatedContext, Context } from "./context";
import { isServiceErrorCause, mapServiceErrorToTRPCError } from "./errors";

export interface OpenApiMeta {
  method: "GET" | "POST";
  path: string;
  protected?: "admin" | "session";
  summary: string;
  tags: string[];
}

export interface ProcedureMeta {
  openapi?: OpenApiMeta;
}

const t = initTRPC
  .context<Context>()
  .meta<ProcedureMeta>()
  .create({
    errorFormatter({ shape, error }) {
      const cause = error.cause;
      const serviceError = isServiceErrorCause(cause)
        ? cause.serviceError
        : null;

      return {
        ...shape,
        data: {
          ...shape.data,
          serviceCode: serviceError?.code,
          serviceDetails: serviceError?.details,
        },
      };
    },
    transformer: superjson,
  });

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
export const createCallerFactory = t.createCallerFactory;

export const requireSession = middleware(async ({ ctx, next }) => {
  if (!ctx.sessionToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Anonymous session required.",
    });
  }

  const sessionService = new SessionService(ctx.db, ctx.redis);
  const result = await sessionService.validateSession(ctx.sessionToken);
  if (!result.ok) throw mapServiceErrorToTRPCError(result.error);

  if (!result.value.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Anonymous session is invalid or expired.",
    });
  }

  if (result.value.banInfo?.banType === "global_hard_ban") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This session is banned.",
    });
  }

  const nextCtx: AuthenticatedContext = {
    ...ctx,
    banInfo: result.value.banInfo,
    session: result.value.session,
    sessionTokenHashHex: hashToken(ctx.sessionToken).toString("hex"),
  };

  return next({ ctx: nextCtx });
});

export const requireAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.adminToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Admin session required.",
    });
  }

  const adminSessionManager = new AdminSessionManager(ctx.db);
  const result = await adminSessionManager.validate(ctx.adminToken, ctx);

  if (!result) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Admin session is invalid or expired.",
    });
  }

  if (!result.admin.isActive) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin account is inactive.",
    });
  }

  const nextCtx: AdminContext = {
    ...ctx,
    admin: result.admin,
    adminSessionId: result.sessionId,
    adminTokenHashHex: result.tokenHashHex,
  };

  return next({ ctx: nextCtx });
});

export const requireAdminRole = (...roles: AdminRole[]) =>
  middleware(async ({ ctx, next }) => {
    const adminCtx = await requireAdminMiddleware(ctx);
    const requiredRank = Math.min(...roles.map(roleRank));

    if (roleRank(adminCtx.admin.role) < requiredRank) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Insufficient admin privileges.",
      });
    }

    return next({ ctx: adminCtx });
  });

export const sessionProcedure = publicProcedure.use(requireSession);
export const adminProcedure = publicProcedure.use(requireAdmin);
export const superAdminProcedure = publicProcedure.use(
  requireAdminRole("super_admin"),
);

async function requireAdminMiddleware(ctx: Context): Promise<AdminContext> {
  if (!ctx.adminToken) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Admin session required.",
    });
  }

  const adminSessionManager = new AdminSessionManager(ctx.db);
  const result = await adminSessionManager.validate(ctx.adminToken, ctx);
  if (!result) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Admin session is invalid or expired.",
    });
  }

  return {
    ...ctx,
    admin: result.admin,
    adminSessionId: result.sessionId,
    adminTokenHashHex: result.tokenHashHex,
  };
}

function roleRank(role: AdminRole): number {
  const ranks: Record<AdminRole, number> = {
    admin: 2,
    moderator: 1,
    super_admin: 3,
  };

  return ranks[role];
}
