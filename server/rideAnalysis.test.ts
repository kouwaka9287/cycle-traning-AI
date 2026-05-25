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
    latDeg: power.map(() => null),
    lonDeg: power.map(() => null),
    temperatureC: power.map(() => null),
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
        latDeg: [],
        lonDeg: [],
        temperatureC: [],
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
  it("parses a simple CSV with time and power columns", async () => {
    const csv =
      "time,power,hr,cadence\n" +
      "0,200,140,90\n" +
      "1,210,141,90\n" +
      "2,205,142,91\n";
    const parsed = await parseRideFile("ride.csv", Buffer.from(csv, "utf-8"));
    expect(parsed.format).toBe("csv");
    const samples = parsed.samples;
    expect(samples.t.length).toBe(3);
    expect(samples.power[0]).toBe(200);
    expect(samples.hr[2]).toBe(142);
    expect(samples.cadence[1]).toBe(90);
  });

  it("normalizes timestamp-based CSV rides to elapsed seconds starting at 0", async () => {
    const csv =
      "timestamp,power\n" +
      "2025-01-01T00:00:00Z,150\n" +
      "2025-01-01T00:00:10Z,155\n" +
      "2025-01-01T00:00:20Z,160\n";
    const parsed = await parseRideFile("ride.csv", Buffer.from(csv, "utf-8"));
    const samples = parsed.samples;
    expect(samples.t[0]).toBe(0);
    expect(samples.t[2]).toBe(20);
  });
});

describe("parseRideFile (FIT)", () => {
  it("rejects invalid FIT magic bytes with a clear error", async () => {
    // 14 bytes minimum but no .FIT signature
    const bogus = Buffer.alloc(64);
    bogus[0] = 14; // header_size
    await expect(
      parseRideFile("ride.fit", bogus),
    ).rejects.toThrowError(/FIT_PARSE_FAILED/);
  });

  it("detects FIT by magic bytes even when extension is missing", async () => {
    // Build a buffer that LOOKS like FIT (has .FIT magic at offset 8) but is
    // otherwise empty - parseRideFile must dispatch to the FIT branch and
    // return format:'fit' with empty samples (rather than silently CSV).
    const buf = Buffer.alloc(64);
    buf[0] = 14;
    buf.write(".FIT", 8, "ascii");
    const parsed = await parseRideFile("ride.bin", buf);
    expect(parsed.format).toBe("fit");
    expect(parsed.samples.t.length).toBe(0);
  });

  it("parses a real round-trip FIT generated by fit-file-parser-compatible encoder", async () => {
    // Build a tiny synthetic FIT file with one File-ID message and three
    // Record messages (timestamp + power + heart_rate + cadence).
    // Layout reference: FIT SDK encoding rules.
    const buf = buildSyntheticFit();
    const parsed = await parseRideFile("synthetic.fit", buf);
    expect(parsed.format).toBe("fit");
    expect(parsed.samples.t.length).toBeGreaterThanOrEqual(3);
    // First three samples are 100,150,200W at 1Hz.
    expect(parsed.samples.power[0]).toBe(100);
    expect(parsed.samples.power[1]).toBe(150);
    expect(parsed.samples.power[2]).toBe(200);
    expect(parsed.samples.hr[0]).toBe(120);
    expect(parsed.samples.cadence[0]).toBe(85);
  });
});

/**
 * Construct a minimal valid FIT binary with:
 *   - 14-byte header (protocol=0x10, profile=2140, dataSize, ".FIT", crc=0)
 *   - File-ID definition + data message (type=activity)
 *   - Record definition + 3 data messages (timestamp, power, heart_rate, cadence)
 *   - 2-byte trailing CRC (zeroed; fit-file-parser with force:true accepts it)
 */
function buildSyntheticFit(): Buffer {
  const chunks: Buffer[] = [];

  // --- File-ID definition message (local message type 0) ---
  // Header byte: 0b0100_0000 = definition for local mt 0
  const fileIdDef = Buffer.from([
    0x40, // record header (definition)
    0x00, // reserved
    0x00, // little-endian arch
    0x00, 0x00, // global msg num = 0 (file_id), LE
    0x01, // num fields = 1
    0x00, 0x01, 0x00, // field 0 (type), size 1, base_type enum (0x00)
  ]);
  // File-ID data message: type=4 (activity)
  const fileIdData = Buffer.from([0x00, 0x04]);

  // --- Record definition message (local message type 1) ---
  // Fields we encode:
  //   field 253 timestamp uint32  (size 4, base_type 0x86)
  //   field 7   power     uint16  (size 2, base_type 0x84)
  //   field 3   heart_rate uint8  (size 1, base_type 0x02)
  //   field 4   cadence   uint8   (size 1, base_type 0x02)
  const recordDef = Buffer.from([
    0x41, // definition for local mt 1
    0x00, // reserved
    0x00, // little-endian
    0x14, 0x00, // global msg num = 20 (record)
    0x04, // num fields = 4
    253, 4, 0x86,
    7, 2, 0x84,
    3, 1, 0x02,
    4, 1, 0x02,
  ]);
  // Three record data messages at 1 Hz, increasing power.
  // FIT timestamps are seconds since 1989-12-31 UTC (offset 631065600).
  const base = 1_000_000_000; // arbitrary monotonic value
  function rec(t: number, power: number, hr: number, cad: number): Buffer {
    const b = Buffer.alloc(1 + 4 + 2 + 1 + 1);
    b[0] = 0x01; // data message, local mt 1
    b.writeUInt32LE(t >>> 0, 1);
    b.writeUInt16LE(power, 5);
    b[7] = hr;
    b[8] = cad;
    return b;
  }
  const r1 = rec(base, 100, 120, 85);
  const r2 = rec(base + 1, 150, 125, 88);
  const r3 = rec(base + 2, 200, 130, 90);

  chunks.push(fileIdDef, fileIdData, recordDef, r1, r2, r3);
  const body = Buffer.concat(chunks);

  // 14-byte header
  const header = Buffer.alloc(14);
  header[0] = 14;        // header size
  header[1] = 0x10;      // protocol version 1.0
  header.writeUInt16LE(2140, 2); // profile version (arbitrary recent)
  header.writeUInt32LE(body.length, 4);
  header.write(".FIT", 8, "ascii");
  // header CRC at bytes 12-13: zero is accepted with force:true
  header.writeUInt16LE(0, 12);

  const trailer = Buffer.alloc(2); // file CRC zeroed (accepted with force:true)
  return Buffer.concat([header, body, trailer]);
}
