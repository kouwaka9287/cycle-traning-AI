import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // verifySession rejects empty `name` strings, so always provide a
      // non-empty fallback even when the OAuth provider does not return one.
      const sessionName = userInfo.name || userInfo.email || userInfo.openId;
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: sessionName,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Recover the original SPA origin from the OAuth state to redirect back
      // to the host the user logged in from (preview vs production etc.).
      let redirectTarget = "/";
      try {
        const decoded = Buffer.from(state, "base64").toString("utf-8");
        // The frontend encodes `${origin}/api/oauth/callback` into state.
        const parsed = new URL(decoded);
        redirectTarget = `${parsed.origin}/`;
      } catch {
        // Fall back to relative root if state cannot be parsed.
      }

      res.redirect(302, redirectTarget);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
