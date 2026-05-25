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
    console.log(
      "[OAuth] /api/oauth/callback hit",
      JSON.stringify({
        host: req.headers.host,
        proto: req.protocol,
        xfp: req.headers["x-forwarded-proto"],
        hasCode: Boolean(req.query.code),
        hasState: Boolean(req.query.state),
      })
    );
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      console.warn("[OAuth] Missing code/state", req.query);
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      console.log("[OAuth] exchanging code for token...");
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      console.log("[OAuth] token exchange ok, fetching user info...");
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      console.log(
        "[OAuth] userInfo received",
        JSON.stringify({
          hasOpenId: Boolean(userInfo.openId),
          hasName: Boolean(userInfo.name),
          hasEmail: Boolean(userInfo.email),
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        })
      );

      if (!userInfo.openId) {
        console.error("[OAuth] openId missing from userInfo", userInfo);
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      console.log("[OAuth] upserting user...");
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });
      console.log("[OAuth] upsert ok");

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

      console.log("[OAuth] cookie set, redirecting to", redirectTarget);
      res.redirect(302, redirectTarget);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      if (error instanceof Error) {
        console.error("[OAuth] error message:", error.message);
        console.error("[OAuth] error stack:", error.stack);
      }
      // surface upstream HTTP error details if it's an Axios error
      const anyErr = error as any;
      if (anyErr?.response) {
        console.error(
          "[OAuth] upstream response",
          anyErr.response.status,
          JSON.stringify(anyErr.response.data)
        );
      }
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
