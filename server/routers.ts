import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  adminRouter,
  aiRouter,
  analyticsRouter,
  profileRouter,
  rideRouter,
  scheduleRouter,
} from "./featureRouters";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  profile: profileRouter,
  admin: adminRouter,
  rides: rideRouter,
  analytics: analyticsRouter,
  ai: aiRouter,
  schedules: scheduleRouter,
});

export type AppRouter = typeof appRouter;
