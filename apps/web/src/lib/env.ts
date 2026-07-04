export const env = {
  enableMap: process.env.NEXT_PUBLIC_ENABLE_MAP === "true",
  trpcUrl:
    process.env.NEXT_PUBLIC_API_TRPC_URL ??
    "http://localhost:4000/trpc",
  realtimeUrl:
    process.env.NEXT_PUBLIC_REALTIME_URL ??
    "http://localhost:4001",
  useMocks:
    process.env.NEXT_PUBLIC_USE_MOCKS === "true",
};
