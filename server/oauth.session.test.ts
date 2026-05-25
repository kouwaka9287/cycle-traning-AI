import { describe, expect, it } from "vitest";
import { sdk } from "./_core/sdk";

/**
 * Regression test for the login bug: callbacks where the OAuth provider does
 * not return a non-empty `name` previously minted a session JWT with an empty
 * `name` claim, which `verifySession` then rejected — producing a permanent
 * "[Auth] Missing session cookie" loop. The OAuth callback now falls back to
 * email/openId, so the minted token must verify in both cases.
 */
describe("OAuth session token", () => {
  it("verifies sessions whose name falls back to email/openId", async () => {
    const cases = [
      { openId: "user-abc", name: "Alice" },
      { openId: "user-no-name", name: "user-no-name@example.com" },
      { openId: "user-anon", name: "user-anon" },
    ];

    for (const c of cases) {
      const token = await sdk.createSessionToken(c.openId, { name: c.name });
      const verified = await sdk.verifySession(token);
      expect(verified).not.toBeNull();
      expect(verified?.openId).toBe(c.openId);
      expect(verified?.name).toBe(c.name);
    }
  });

  it("returns null for a token minted with an empty name", async () => {
    const token = await sdk.createSessionToken("user-empty", { name: "" });
    const verified = await sdk.verifySession(token);
    expect(verified).toBeNull();
  });

  it("returns null for missing or malformed cookies", async () => {
    expect(await sdk.verifySession(undefined)).toBeNull();
    expect(await sdk.verifySession("")).toBeNull();
    expect(await sdk.verifySession("not-a-jwt")).toBeNull();
  });
});
