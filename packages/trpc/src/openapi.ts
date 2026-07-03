import type { OpenApiMeta } from "./trpc";

export interface OpenApiDocumentOptions {
  baseUrl?: string;
  title?: string;
  version?: string;
}

export interface ProcedureDoc {
  name: string;
  openapi: OpenApiMeta;
  type: "mutation" | "query";
}

export const procedureDocs: ProcedureDoc[] = [
  {
    name: "session.create",
    openapi: {
      method: "POST",
      path: "/session/create",
      summary: "Create an anonymous session",
      tags: ["Session"],
    },
    type: "mutation",
  },
  {
    name: "session.validate",
    openapi: {
      method: "POST",
      path: "/session/validate",
      summary: "Validate an anonymous session token",
      tags: ["Session"],
    },
    type: "query",
  },
  {
    name: "session.getCurrent",
    openapi: {
      method: "GET",
      path: "/session/current",
      protected: "session",
      summary: "Get the current anonymous session",
      tags: ["Session"],
    },
    type: "query",
  },
  {
    name: "session.updateDisplayName",
    openapi: {
      method: "POST",
      path: "/session/display-name",
      protected: "session",
      summary: "Update the current user's public display name",
      tags: ["Session"],
    },
    type: "mutation",
  },
  {
    name: "session.updateDisplayColor",
    openapi: {
      method: "POST",
      path: "/session/display-color",
      protected: "session",
      summary: "Update the current user's public display color",
      tags: ["Session"],
    },
    type: "mutation",
  },
  {
    name: "session.getDisplayNameHistory",
    openapi: {
      method: "GET",
      path: "/session/display-name-history",
      protected: "session",
      summary: "Get display-name history for the current anonymous user",
      tags: ["Session"],
    },
    type: "query",
  },
  {
    name: "session.revoke",
    openapi: {
      method: "POST",
      path: "/session/revoke",
      protected: "session",
      summary: "Revoke the current anonymous session",
      tags: ["Session"],
    },
    type: "mutation",
  },
  {
    name: "location.verify",
    openapi: {
      method: "POST",
      path: "/location/verify",
      protected: "session",
      summary: "Verify campus geofence location for write actions",
      tags: ["Location"],
    },
    type: "mutation",
  },
  {
    name: "location.checkStatus",
    openapi: {
      method: "GET",
      path: "/location/status",
      protected: "session",
      summary: "Check whether the current session has valid write location",
      tags: ["Location"],
    },
    type: "query",
  },
  {
    name: "room.list",
    openapi: {
      method: "GET",
      path: "/rooms",
      protected: "session",
      summary: "List public rooms",
      tags: ["Rooms"],
    },
    type: "query",
  },
  {
    name: "room.create",
    openapi: {
      method: "POST",
      path: "/rooms",
      protected: "session",
      summary: "Create a room",
      tags: ["Rooms"],
    },
    type: "mutation",
  },
  {
    name: "room.getById",
    openapi: {
      method: "GET",
      path: "/rooms/by-id",
      protected: "session",
      summary: "Get room details by id",
      tags: ["Rooms"],
    },
    type: "query",
  },
  {
    name: "room.getBySlug",
    openapi: {
      method: "GET",
      path: "/rooms/by-slug",
      protected: "session",
      summary: "Get room details by slug",
      tags: ["Rooms"],
    },
    type: "query",
  },
  {
    name: "room.getShareInfo",
    openapi: {
      method: "GET",
      path: "/rooms/share-info",
      protected: "session",
      summary: "Get share information for a room",
      tags: ["Rooms"],
    },
    type: "query",
  },
  {
    name: "room.regenerateInvite",
    openapi: {
      method: "POST",
      path: "/rooms/invite/regenerate",
      protected: "session",
      summary: "Regenerate a private room invite link",
      tags: ["Rooms"],
    },
    type: "mutation",
  },
  {
    name: "room.disableInvite",
    openapi: {
      method: "POST",
      path: "/rooms/invite/disable",
      protected: "session",
      summary: "Disable a private room invite link",
      tags: ["Rooms"],
    },
    type: "mutation",
  },
  {
    name: "room.join",
    openapi: {
      method: "POST",
      path: "/rooms/join",
      protected: "session",
      summary: "Join a room",
      tags: ["Rooms"],
    },
    type: "mutation",
  },
  {
    name: "room.leave",
    openapi: {
      method: "POST",
      path: "/rooms/leave",
      protected: "session",
      summary: "Leave a room",
      tags: ["Rooms"],
    },
    type: "mutation",
  },
  {
    name: "room.getParticipants",
    openapi: {
      method: "GET",
      path: "/rooms/participants",
      protected: "session",
      summary: "List active room participants",
      tags: ["Rooms"],
    },
    type: "query",
  },
  {
    name: "message.getHistory",
    openapi: {
      method: "GET",
      path: "/messages/history",
      protected: "session",
      summary: "Get room message history",
      tags: ["Messages"],
    },
    type: "query",
  },
  {
    name: "message.getById",
    openapi: {
      method: "GET",
      path: "/messages/by-id",
      protected: "session",
      summary: "Get a visible message by id",
      tags: ["Messages"],
    },
    type: "query",
  },
  {
    name: "message.getRecent",
    openapi: {
      method: "GET",
      path: "/messages/recent",
      protected: "session",
      summary: "Get recent visible messages for a room",
      tags: ["Messages"],
    },
    type: "query",
  },
  {
    name: "message.addReaction",
    openapi: {
      method: "POST",
      path: "/messages/reactions",
      protected: "session",
      summary: "Add a reaction to a visible message",
      tags: ["Messages"],
    },
    type: "mutation",
  },
  {
    name: "message.removeReaction",
    openapi: {
      method: "POST",
      path: "/messages/reactions/remove",
      protected: "session",
      summary: "Remove the current user's reaction from a message",
      tags: ["Messages"],
    },
    type: "mutation",
  },
  {
    name: "message.deleteOwn",
    openapi: {
      method: "POST",
      path: "/messages/delete-own",
      protected: "session",
      summary: "Delete a message owned by the current user",
      tags: ["Messages"],
    },
    type: "mutation",
  },
  {
    name: "report.create",
    openapi: {
      method: "POST",
      path: "/reports",
      protected: "session",
      summary: "Create a moderation report",
      tags: ["Reports"],
    },
    type: "mutation",
  },
  {
    name: "media.createUploadToken",
    openapi: {
      method: "POST",
      path: "/media/upload-token",
      protected: "session",
      summary: "Create metadata for a direct media upload",
      tags: ["Media"],
    },
    type: "mutation",
  },
  {
    name: "media.getAsset",
    openapi: {
      method: "GET",
      path: "/media/assets/by-id",
      protected: "session",
      summary: "Get media asset metadata",
      tags: ["Media"],
    },
    type: "query",
  },
  {
    name: "admin.login",
    openapi: {
      method: "POST",
      path: "/admin/login",
      summary: "Create an admin session",
      tags: ["Admin"],
    },
    type: "mutation",
  },
  {
    name: "admin.logout",
    openapi: {
      method: "POST",
      path: "/admin/logout",
      protected: "admin",
      summary: "Revoke the current admin session",
      tags: ["Admin"],
    },
    type: "mutation",
  },
  {
    name: "admin.getCurrent",
    openapi: {
      method: "GET",
      path: "/admin/current",
      protected: "admin",
      summary: "Get the current admin",
      tags: ["Admin"],
    },
    type: "query",
  },
  {
    name: "admin.create",
    openapi: {
      method: "POST",
      path: "/admin/users",
      protected: "admin",
      summary: "Create an admin user",
      tags: ["Admin"],
    },
    type: "mutation",
  },
  {
    name: "moderation.banUser",
    openapi: {
      method: "POST",
      path: "/moderation/bans",
      protected: "admin",
      summary: "Create a user/session ban",
      tags: ["Moderation"],
    },
    type: "mutation",
  },
  {
    name: "moderation.revokeBan",
    openapi: {
      method: "POST",
      path: "/moderation/bans/revoke",
      protected: "admin",
      summary: "Revoke an active ban",
      tags: ["Moderation"],
    },
    type: "mutation",
  },
  {
    name: "moderation.resolveReport",
    openapi: {
      method: "POST",
      path: "/moderation/reports/resolve",
      protected: "admin",
      summary: "Resolve or dismiss a moderation report",
      tags: ["Moderation"],
    },
    type: "mutation",
  },
  {
    name: "moderation.getReport",
    openapi: {
      method: "GET",
      path: "/moderation/reports/by-id",
      protected: "admin",
      summary: "Get a moderation report by id",
      tags: ["Moderation"],
    },
    type: "query",
  },
];

export function createOpenApiDocument(options: OpenApiDocumentOptions = {}) {
  const title = options.title ?? "Campus Chat API";
  const version = options.version ?? "0.1.0";
  const baseUrl = options.baseUrl ?? "/api/trpc";

  return {
    components: {
      securitySchemes: {
        AdminToken: {
          in: "header",
          name: "x-admin-token",
          type: "apiKey",
        },
        SessionBearer: {
          scheme: "bearer",
          type: "http",
        },
      },
    },
    info: {
      title,
      version,
    },
    openapi: "3.1.0",
    paths: Object.fromEntries(
      procedureDocs.map((doc) => [
        doc.openapi.path,
        {
          [doc.openapi.method.toLowerCase()]: {
            description: `tRPC procedure: ${doc.name}`,
            operationId: doc.name.replaceAll(".", "_"),
            requestBody:
              doc.openapi.method === "POST"
                ? {
                    content: {
                      "application/json": {
                        schema: {
                          additionalProperties: true,
                          type: "object",
                        },
                      },
                    },
                    required: false,
                  }
                : undefined,
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      additionalProperties: true,
                      type: "object",
                    },
                  },
                },
                description: "Successful response",
              },
            },
            security: securityFor(doc.openapi.protected),
            summary: doc.openapi.summary,
            tags: doc.openapi.tags,
            "x-trpc-procedure": doc.name,
            "x-trpc-type": doc.type,
          },
        },
      ]),
    ),
    servers: [{ url: baseUrl }],
  };
}

export const openApiDocument = createOpenApiDocument();

export function createScalarHtml(options: {
  pageTitle?: string;
  specUrl: string;
}): string {
  const pageTitle = options.pageTitle ?? "Campus Chat API Docs";
  const configuration = JSON.stringify({
    theme: "default",
    url: options.specUrl,
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(pageTitle)}</title>
  </head>
  <body>
    <script id="api-reference" data-configuration='${escapeHtml(configuration)}'></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
}

function securityFor(protectedBy: OpenApiMeta["protected"]) {
  if (protectedBy === "admin") return [{ AdminToken: [] }];
  if (protectedBy === "session") return [{ SessionBearer: [] }];
  return undefined;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
