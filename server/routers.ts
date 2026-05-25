import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import {
  adminRouter,
  aiRouter,
  analyticsRouter,
  profileRouter,
  rideRouter,
  scheduleRouter,
} from "./featureRouters";

/**
 * Derive the host-login passphrase from environment secrets at runtime.
 * We intentionally avoid printing it; the project owner can read it from the
 * Manus secrets panel as the literal value of `HOST_LOGIN_PASSPHRASE`, or
 * fall back to the first 12 chars of `JWT_SECRET` if no explicit value exists.
 */
function getHostLoginPassphrase(): string {
  const explicit = process.env.HOST_LOGIN_PASSPHRASE;
  if (explicit && explicit.length >= 4) return explicit;
  return (process.env.JWT_SECRET ?? "").slice(0, 12);
}

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
    /**
     * Host direct login: bypasses Manus OAuth so the project owner can sign
     * in even from contexts where the OAuth popup / third-party cookies are
     * blocked (e.g. the Manus webdev preview iframe).
     *
     * Only the configured OWNER_OPEN_ID may use this entry point, and only
     * with the correct passphrase. The session it issues is identical to a
     * normal OAuth session and grants admin role automatically through the
     * existing owner-aware upsert in `db.upsertUser`.
     */
    hostLogin: publicProcedure
      .input(
        z.object({
          passphrase: z
            .string()
            .min(4, "パスフレーズが短すぎます")
            .max(256),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const ownerOpenId = ENV.ownerOpenId;
        if (!ownerOpenId) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "OWNER_OPEN_IDが設定されていません",
          });
        }
        const expected = getHostLoginPassphrase();
        if (!expected) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "ホストログインが利用できない構成です",
          });
        }
        if (input.passphrase !== expected) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "パスフレーズが一致しません",
          });
        }

        const ownerName = ENV.ownerName || "HOST OPERATOR";
        // Make sure the host user row exists and is admin/approved.
        await db.upsertUser({
          openId: ownerOpenId,
          name: ownerName,
          loginMethod: "host-direct",
          lastSignedIn: new Date(),
        });

        const token = await sdk.createSessionToken(ownerOpenId, {
          name: ownerName || ownerOpenId,
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        return { success: true } as const;
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
