import {
  createOpenApiDocument,
  createScalarHtml,
} from "@campus-chat/trpc/server";
import { type Router, Router as createRouter } from "express";

export function createOpenApiRouter(): Router {
  const router = createRouter();

  router.get("/openapi.json", (req, res) => {
    const origin = `${req.protocol}://${req.get("host")}`;

    res.json(
      createOpenApiDocument({
        baseUrl: `${origin}/trpc`,
        title: "Campus Chat API",
        version: "0.1.0",
      }),
    );
  });

  router.get("/docs", (_req, res) => {
    res.type("html").send(createScalarHtml({ specUrl: "/openapi.json" }));
  });

  return router;
}
