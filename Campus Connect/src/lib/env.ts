export const env = {
  trpcUrl:
    (import.meta.env.VITE_API_TRPC_URL as string | undefined) ??
    "http://localhost:4000/trpc",
  realtimeUrl:
    (import.meta.env.VITE_REALTIME_URL as string | undefined) ??
    "http://localhost:4001",
  useMocks:
    (import.meta.env.VITE_USE_MOCKS as string | undefined) !== "false",
};
