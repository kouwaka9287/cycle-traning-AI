import { describe, expect, it } from "vitest";
import {
  computeLoadMetrics,
  computeRideMetrics,
  parseRideFile,
  type RideSamples,
} from "./rideAnalysis";

function constantPowerSamples(seconds: number, watts: number): RideSamples {
  const t: number[] = [];
  const power: (number | null)[] = [];
  for (let i = 0; i <= seconds; i++) {
    t.push(i);
    power.push(watts);
  }
  return {
    t,
    power,
    hr: power.map(() => null),
    cadence: power.map(() => null),
    speedMps: power.map(() => null),
    distanceM: power.map(() => null),
    altitudeM: power.map(() => null),
  };
}

describe("computeRideMetrics", () => {
  it("returns IF=1.0 and TSS≈100 for a 60-min ride exactly at FTP", () => {
    const samples = constantPowerSamples(60 * 60, 250);
    const m = computeRideMetrics(samples, 250);
    expect(m.durationSec).toBe(60 * 60);
    expect(m.avgPower).toBe(250);
    // For constant power, normalized power equals avg power
    expect(m.normalizedPower).toBe(250);
    expect(m.intensityFactor).toBeCloseTo(1.0, 2);
    expect(m.tss).toBeGreaterThanOrEqual(99);
    expect(m.tss).toBeLessThanOrEqual(101);
  });

  it("counts SST seconds when riding in 88-94% FTP band", () => {
    const samples = constantPowerSamples(20 * 60, 220); // 88% of 250
    const m = computeRideMetrics(samples, 250);
    // At least most of the 20 minutes should land in SST band
    expect(m.sstSeconds).toBeGreaterThan(60 * 18);
  });

  it("yields TSS=null when FTP is missing", () => {
    const samples = constantPowerSamples(30 * 60, 200);
    const m = computeRideMetrics(samples, null);
    expect(m.tss).toBeNull();
    expect(m.intensityFactor).toBeNull();
    // Training score still produced (duration based)
    expect(m.trainingScore).toBeGreaterThan(0);
  });

  it("returns zeroed metrics for empty samples", () => {
    const m = computeRideMetrics(
      {
        t: [],
        power: [],
        hr: [],
        cadence: [],
        speedMps: [],
        distanceM: [],
        altitudeM: [],
      },
      250,
    );
    expect(m.durationSec).toBe(0);
    expect(m.avgPower).toBeNull();
    expect(m.tss).toBeNull();
    expect(m.trainingScore).toBe(0);
  });
});

describe("computeLoadMetrics (CTL/ATL/TSB)", () => {
  it("classifies fresh form when CTL > ATL", () => {
    const today = new Date();
    const points: { rideDate: Date; tss: number }[] = [];
    // Many days of rides ending 30 days ago, then nothing recent
    for (let i = 30; i <= 90; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      points.push({ rideDate: d, tss: 80 });
    }
    const lm = computeLoadMetrics(points);
    expect(lm.ctl).toBeGreaterThan(lm.atl);
    expect(["fresh", "optimal"]).toContain(lm.fatigueLevel);
  });

  it("flags very_high fatigue with sustained heavy recent load", () => {
    const today = new Date();
    const points: { rideDate: Date; tss: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      points.push({ rideDate: d, tss: 200 });
    }
    const lm = computeLoadMetrics(points);
    expect(lm.atl).toBeGreaterThan(lm.ctl);
    expect(["high", "very_high", "elevated"]).toContain(lm.fatigueLevel);
  });
});

describe("parseRideFile (CSV)", () => {
  it("parses a simple CSV with time and power columns", () => {
    const csv =
      "time,power,hr,cadence\n" +
      "0,200,140,90\n" +
      "1,210,141,90\n" +
      "2,205,142,91\n";
    const samples = parseRideFile("ride.csv", Buffer.from(csv, "utf-8"));
    expect(samples.t.length).toBe(3);
    expect(samples.power[0]).toBe(200);
    expect(samples.hr[2]).toBe(142);
    expect(samples.cadence[1]).toBe(90);
  });

  it("normalizes timestamp-based CSV rides to elapsed seconds starting at 0", () => {
    const csv =
      "timestamp,power\n" +
      "2025-01-01T00:00:00Z,150\n" +
      "2025-01-01T00:00:10Z,155\n" +
      "2025-01-01T00:00:20Z,160\n";
    const samples = parseRideFile("ride.csv", Buffer.from(csv, "utf-8"));
    expect(samples.t[0]).toBe(0);
    expect(samples.t[2]).toBe(20);
  });
});
