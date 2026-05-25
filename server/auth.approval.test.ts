import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import { approvedProcedure, adminProcedure, router } from "./_core/trpc";
import type { TrpcContext } from "./_core/context";

const baseUser = {
  id: 1,
  openId: "test-user",
  email: "test@example.com",
  name: "Test",
  realName: "Real Test",
  displayName: "test_nick",
  loginMethod: "manus",
  role: "user" as const,
  approvalStatus: "pending" as const,
  rejectionReason: null,
  approvedAt: null,
  approvedByUserId: null,
  heightCm: null,
  weightKg: null,
  ftp: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function ctxWith(user: TrpcContext["user"] | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

const testRouter = router({
  approvedOnly: approvedProcedure.query(() => "ok"),
  adminOnly: adminProcedure.query(() => "ok"),
});

describe("approvedProcedure middleware", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = testRouter.createCaller(ctxWith(null));
    await expect(caller.approvedOnly()).rejects.toBeInstanceOf(TRPCError);
  });

  it("blocks pending users from accessing approved procedures", async () => {
    const caller = testRouter.createCaller(ctxWith({ ...baseUser }));
    await expect(caller.approvedOnly()).rejects.toThrow(/PENDING/);
  });

  it("blocks rejected users from accessing approved procedures", async () => {
    const caller = testRouter.createCaller(
      ctxWith({ ...baseUser, approvalStatus: "rejected" }),
    );
    await expect(caller.approvedOnly()).rejects.toBeInstanceOf(TRPCError);
  });

  it("allows approved users through approved procedures", async () => {
    const caller = testRouter.createCaller(
      ctxWith({ ...baseUser, approvalStatus: "approved" }),
    );
    await expect(caller.approvedOnly()).resolves.toBe("ok");
  });
});

describe("adminProcedure middleware", () => {
  it("rejects non-admin callers even if approved", async () => {
    const caller = testRouter.createCaller(
      ctxWith({ ...baseUser, approvalStatus: "approved", role: "user" }),
    );
    await expect(caller.adminOnly()).rejects.toBeInstanceOf(TRPCError);
  });

  it("allows admin callers", async () => {
    const caller = testRouter.createCaller(
      ctxWith({ ...baseUser, approvalStatus: "approved", role: "admin" }),
    );
    await expect(caller.adminOnly()).resolves.toBe("ok");
  });
});
