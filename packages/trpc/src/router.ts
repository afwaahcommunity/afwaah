import { router } from "./trpc";
import {
  adminRouter,
  locationRouter,
  mediaRouter,
  messageRouter,
  moderationRouter,
  reportRouter,
  roomRouter,
  sessionRouter,
} from "./routers";

export const appRouter = router({
  admin: adminRouter,
  location: locationRouter,
  media: mediaRouter,
  message: messageRouter,
  moderation: moderationRouter,
  report: reportRouter,
  room: roomRouter,
  session: sessionRouter,
});

export type AppRouter = typeof appRouter;
