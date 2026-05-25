import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";
import type { Request } from "express";

function buildReq(opts: { protocol?: string; xfp?: string }): Request {
  return {
    protocol: opts.protocol ?? "http",
    headers: opts.xfp ? { "x-forwarded-proto": opts.xfp } : {},
  } as unknown as Request;
}

describe("getSessionCookieOptions", () => {
  it("always emits Secure=true so SameSite=None cookies are accepted", () => {
    const httpsReq = buildReq({ protocol: "https" });
    const httpReq = buildReq({ protocol: "http" });
    const forwardedReq = buildReq({ protocol: "http", xfp: "https" });

    for (const req of [httpsReq, httpReq, forwardedReq]) {
      const opts = getSessionCookieOptions(req);
      expect(opts.secure).toBe(true);
      expect(opts.sameSite).toBe("none");
      expect(opts.httpOnly).toBe(true);
      expect(opts.path).toBe("/");
    }
  });
});
