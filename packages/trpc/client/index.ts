import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { ServerRouter } from "../server";

export type RouterInputs = inferRouterInputs<ServerRouter>;
export type RouterOutputs = inferRouterOutputs<ServerRouter>;
export type { ServerRouter } from "../server";

export {
  createClient,
  type CreateClientOptions,
  type TRPCClient,
} from "../src/client";
export * from "@trpc/client";
