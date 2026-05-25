import { describe, expect, it } from "vitest";
import { dictionaries } from "../client/src/i18n/dictionary";

describe("i18n dictionary", () => {
  it("includes ja, en, zh, ko, fr, es", () => {
    expect(Object.keys(dictionaries).sort()).toEqual(
      ["en", "es", "fr", "ja", "ko", "zh"].sort(),
    );
  });

  it("ja contains the master keys for every page", () => {
    const ja = dictionaries.ja;
    expect(ja["auth.initiateLogin"]).toBeTruthy();
    expect(ja["nav.dashboard"]).toBeTruthy();
    expect(ja["upload.formatFit"]).toBeTruthy();
    expect(ja["coach.title"]).toBeTruthy();
    expect(ja["admin.title"]).toBeTruthy();
    expect(ja["calendar.title"]).toBeTruthy();
    expect(ja["stats.title"]).toBeTruthy();
    expect(ja["schedules.title"]).toBeTruthy();
    expect(ja["profile.title"]).toBeTruthy();
  });

  it("each non-ja dictionary translates a strategic subset of keys", () => {
    const sampleKeys = [
      "auth.initiateLogin",
      "nav.dashboard",
      "common.save",
      "upload.formatFit",
    ] as const;
    for (const lang of ["en", "zh", "ko", "fr", "es"] as const) {
      for (const k of sampleKeys) {
        const value = (dictionaries[lang] as Record<string, string>)[k];
        expect(value, `${lang}.${k} should be translated`).toBeTruthy();
      }
    }
  });

  it("contains no duplicate keys after dedupe", () => {
    for (const code of ["ja", "en", "zh", "ko", "fr", "es"] as const) {
      const dict = dictionaries[code] as Record<string, string>;
      const keys = Object.keys(dict);
      expect(new Set(keys).size, `${code} should have unique keys`).toBe(
        keys.length,
      );
    }
  });
});
