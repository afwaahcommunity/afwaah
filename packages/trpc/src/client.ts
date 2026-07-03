import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

import type { AppRouter } from "./router";

export type { AppRouter };

export interface CreateClientOptions {
  headers?: () => Record<string, string>;
  url: string;
}

export function createClient({ headers, url }: CreateClientOptions) {
  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        headers,
        transformer: superjson,
        url,
      }),
    ],
  });
}

export type TRPCClient = ReturnType<typeof createClient>;
