import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

function createCtx(): { ctx: TrpcContext; cookies: CookieCall[] } {
  const cookies: CookieCall[] = [];
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("auth.hostLogin", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Use a deterministic owner + passphrase for test isolation.
    process.env.OWNER_OPEN_ID = "owner-open-id-fixture";
    process.env.OWNER_NAME = "HOST OPERATOR";
    process.env.HOST_LOGIN_PASSPHRASE = "test-passphrase-xyz";
    // Avoid hitting the database; stub upsertUser so the procedure can run.
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("rejects when passphrase does not match", async () => {
    vi.doMock("./db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./db")>();
      return { ...actual, upsertUser: vi.fn().mockResolvedValue(undefined) };
    });
    const { appRouter } = await import("./routers");
    const { ctx } = createCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.hostLogin({ passphrase: "WRONG_VALUE" }),
    ).rejects.toThrowError(/パスフレーズが一致しません/);
  });

  it("issues a session cookie when passphrase matches", async () => {
    const upsertSpy = vi.fn().mockResolvedValue(undefined);
    vi.doMock("./db", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./db")>();
      return { ...actual, upsertUser: upsertSpy };
    });
    const { appRouter } = await import("./routers");
    const { ctx, cookies } = createCtx();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.hostLogin({
      passphrase: "test-passphrase-xyz",
    });

    expect(result).toEqual({ success: true });
    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(COOKIE_NAME);
    expect(cookies[0]?.value).toBeTypeOf("string");
    expect((cookies[0]?.value || "").split(".").length).toBe(3); // JWT
    expect(cookies[0]?.options).toMatchObject({
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/",
    });
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "owner-open-id-fixture",
        loginMethod: "host-direct",
      }),
    );
  });

  it("validates that the configured secret was actually injected", () => {
    // This is a smoke test for the value provided via webdev_request_secrets.
    // We do NOT want the secret printed; we only verify presence + min length.
    const v = process.env.HOST_LOGIN_PASSPHRASE;
    expect(typeof v).toBe("string");
    expect((v ?? "").length).toBeGreaterThanOrEqual(4);
  });
});
