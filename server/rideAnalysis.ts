/**
 * Ride file parsing and metric calculation.
 *
 * Primary format: .FIT (Garmin / Wahoo / Polar / Hammerhead etc.).
 *   - Decoded via `fit-file-parser` to extract record / session / lap / sport
 *     messages with full field fidelity (power, hr, cadence, enhanced_speed,
 *     enhanced_altitude, distance, position_lat/long, temperature, timestamp).
 *
 * Legacy format: .CSV / .TXT with at minimum a "time" or "seconds" column plus
 *   "power" (watts). Optional columns: hr, heart_rate, cadence, speed,
 *   distance, altitude.
 */

import FitParser from "fit-file-parser";

export type RideSamples = {
  /** seconds elapsed from start of ride */
  t: number[];
  power: (number | null)[];
  hr: (number | null)[];
  cadence: (number | null)[];
  speedMps: (number | null)[];
  distanceM: (number | null)[];
  altitudeM: (number | null)[];
  /** GPS latitude in degrees (FIT only). */
  latDeg?: (number | null)[];
  /** GPS longitude in degrees (FIT only). */
  lonDeg?: (number | null)[];
  /** Sensor temperature in °C (FIT only). */
  temperatureC?: (number | null)[];
  startTimeMs?: number;
};

export type RideMetrics = {
  durationSec: number;
  distanceKm: number;
  elevationM: number;
  avgPower: number | null;
  maxPower: number | null;
  normalizedPower: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgCadence: number | null;
  avgSpeedKph: number | null;
  kj: number | null;
  intensityFactor: number | null;
  tss: number | null;
  sstSeconds: number;
  trainingScore: number;
  zoneSeconds: number[];
};

const POWER_ZONES = [
  { name: "Z1 Recovery", lo: 0, hi: 0.55 },
  { name: "Z2 Endurance", lo: 0.55, hi: 0.75 },
  { name: "Z3 Tempo", lo: 0.75, hi: 0.88 },
  { name: "Z4 Threshold", lo: 0.88, hi: 1.05 },
  { name: "Z5 VO2max", lo: 1.05, hi: 1.2 },
  { name: "Z6 Anaerobic", lo: 1.2, hi: 1.5 },
  { name: "Z7 Neuromuscular", lo: 1.5, hi: 99 },
];

export const POWER_ZONE_LABELS = POWER_ZONES.map((z) => z.name);

function parseCsv(text: string): RideSamples {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { t: [], power: [], hr: [], cadence: [], speedMps: [], distanceM: [], altitudeM: [] };
  }
  const header = lines[0].split(",").map((s) => s.trim().toLowerCase().replace(/"/g, ""));

  const indexOf = (...candidates: string[]) =>
    candidates.map((c) => header.indexOf(c)).find((i) => i !== -1) ?? -1;

  const idxTime = indexOf("time", "seconds", "elapsed", "elapsed_time", "secs");
  const idxTimestamp = indexOf("timestamp", "datetime", "date_time");
  const idxPower = indexOf("power", "watts", "power_w");
  const idxHr = indexOf("hr", "heart_rate", "heartrate", "bpm");
  const idxCad = indexOf("cadence", "rpm");
  const idxSpd = indexOf("speed", "speed_mps", "speed_ms");
  const idxSpdKph = indexOf("speed_kph", "speedkph", "kph");
  const idxDist = indexOf("distance", "distance_m", "dist");
  const idxAlt = indexOf("altitude", "elevation", "altitude_m");

  const samples: RideSamples = {
    t: [],
    power: [],
    hr: [],
    cadence: [],
    speedMps: [],
    distanceM: [],
    altitudeM: [],
  };

  let firstTimeMs: number | null = null;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 2) continue;

    let elapsed: number | null = null;
    if (idxTime !== -1) {
      const v = parseFloat(cols[idxTime]);
      if (!isNaN(v)) elapsed = v;
    }
    if (elapsed === null && idxTimestamp !== -1) {
      const ts = Date.parse(cols[idxTimestamp]);
      if (!isNaN(ts)) {
        if (firstTimeMs === null) firstTimeMs = ts;
        elapsed = (ts - firstTimeMs) / 1000;
      }
    }
    if (elapsed === null) {
      // Fallback: assume 1Hz consecutive samples
      elapsed = i - 1;
    }

    samples.t.push(elapsed);
    samples.power.push(idxPower !== -1 ? safeFloat(cols[idxPower]) : null);
    samples.hr.push(idxHr !== -1 ? safeFloat(cols[idxHr]) : null);
    samples.cadence.push(idxCad !== -1 ? safeFloat(cols[idxCad]) : null);

    if (idxSpd !== -1) {
      samples.speedMps.push(safeFloat(cols[idxSpd]));
    } else if (idxSpdKph !== -1) {
      const v = safeFloat(cols[idxSpdKph]);
      samples.speedMps.push(v !== null ? v / 3.6 : null);
    } else {
      samples.speedMps.push(null);
    }

    samples.distanceM.push(idxDist !== -1 ? safeFloat(cols[idxDist]) : null);
    samples.altitudeM.push(idxAlt !== -1 ? safeFloat(cols[idxAlt]) : null);
  }

  if (firstTimeMs !== null) samples.startTimeMs = firstTimeMs;
  return samples;
}

function safeFloat(v: string | undefined): number | null {
  if (v === undefined) return null;
  const x = parseFloat(v);
  return isNaN(x) ? null : x;
}

/**
 * Parsed FIT context that we return alongside the samples so callers can
 * surface device, sport, and session-level metadata.
 */
export type FitContext = {
  sport?: string | null;
  subSport?: string | null;
  device?: string | null;
  startTimeMs?: number;
  /** Sum of `total_timer_time` from session messages (active moving seconds). */
  totalTimerSec?: number | null;
  /** Sum of `total_elapsed_time` from session messages. */
  totalElapsedSec?: number | null;
  /** Pre-computed by the device (we still recompute, but display for reference). */
  deviceAvgPower?: number | null;
  deviceNormalizedPower?: number | null;
  deviceTotalDistanceM?: number | null;
  deviceTotalAscentM?: number | null;
  deviceCalories?: number | null;
};

export type ParsedRide = {
  samples: RideSamples;
  fit?: FitContext;
  format: "fit" | "csv" | "unknown";
};

/** FIT records use signed int32 semicircles - convert to decimal degrees. */
function semicirclesToDegrees(sc: number): number {
  return sc * (180 / 2 ** 31);
}

/**
 * Robust FIT decoder built on `fit-file-parser`.
 * Returns ride samples + session/device context for richer analytics.
 * Throws an Error (with a user-facing message) if the file is not a valid FIT.
 */
async function parseFit(buf: Buffer): Promise<ParsedRide> {
  if (buf.length < 14 || buf.slice(8, 12).toString("ascii") !== ".FIT") {
    throw new Error("INVALID_FIT_HEADER");
  }

  const parser = new FitParser({
    force: true,
    speedUnit: "m/s",
    lengthUnit: "m",
    temperatureUnit: "celsius",
    elapsedRecordField: false,
    mode: "list",
  });

  // The fit-file-parser default export is the class; use parseAsync.
  const data = await parser.parseAsync(
    // The lib accepts ArrayBuffer / Buffer; pass underlying bytes for safety.
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
  );

  // fit-file-parser exports its own narrow types (ParsedRecord/ParsedSession
  // etc.). For dynamic field access we go through `unknown` so TS doesn't
  // demand an index signature on each generated interface.
  const records = (Array.isArray(data?.records)
    ? (data.records as unknown as Array<Record<string, unknown>>)
    : []) as Array<Record<string, unknown>>;
  const sessions = (Array.isArray(data?.sessions)
    ? (data.sessions as unknown as Array<Record<string, unknown>>)
    : []) as Array<Record<string, unknown>>;
  const sports = (Array.isArray(data?.sports)
    ? (data.sports as unknown as Array<Record<string, unknown>>)
    : []) as Array<Record<string, unknown>>;
  const deviceInfos = (Array.isArray(data?.device_infos)
    ? (data.device_infos as unknown as Array<Record<string, unknown>>)
    : []) as Array<Record<string, unknown>>;

  const samples: RideSamples = {
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
  };

  let firstTimeMs: number | null = null;
  for (const rec of records) {
    const ts = rec.timestamp;
    let elapsed: number | null = null;
    if (ts instanceof Date) {
      const ms = ts.getTime();
      if (firstTimeMs === null) firstTimeMs = ms;
      elapsed = (ms - firstTimeMs) / 1000;
    } else if (typeof ts === "number" && Number.isFinite(ts)) {
      if (firstTimeMs === null) firstTimeMs = ts;
      elapsed = (ts - firstTimeMs) / 1000;
    } else {
      elapsed = samples.t.length; // 1Hz fallback
    }
    samples.t.push(elapsed);

    const num = (k: string): number | null => {
      const v = rec[k];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    };

    samples.power.push(num("power"));
    samples.hr.push(num("heart_rate"));
    samples.cadence.push(num("cadence"));

    // Speed: prefer enhanced_speed; fallback to speed.
    const spd = num("enhanced_speed") ?? num("speed");
    samples.speedMps.push(spd);

    samples.distanceM.push(num("distance"));

    const alt = num("enhanced_altitude") ?? num("altitude");
    samples.altitudeM.push(alt);

    const lat = num("position_lat");
    const lon = num("position_long");
    // Many FIT devices encode positions in semicircles; also accept degrees if
    // the library has already converted (when |value| <= 180).
    samples.latDeg!.push(
      lat == null ? null : Math.abs(lat) > 180 ? semicirclesToDegrees(lat) : lat,
    );
    samples.lonDeg!.push(
      lon == null ? null : Math.abs(lon) > 180 ? semicirclesToDegrees(lon) : lon,
    );
    samples.temperatureC!.push(num("temperature"));
  }

  if (firstTimeMs !== null) samples.startTimeMs = firstTimeMs;

  // Aggregate FitContext from session messages.
  const ctx: FitContext = {};
  if (sessions.length > 0) {
    let timer = 0;
    let elapsedSec = 0;
    let dist = 0;
    let ascent = 0;
    let cal = 0;
    let avgP: number | null = null;
    let np: number | null = null;
    for (const s of sessions) {
      const sNum = (k: string) =>
        typeof s[k] === "number" && Number.isFinite(s[k] as number)
          ? (s[k] as number)
          : null;
      timer += sNum("total_timer_time") ?? 0;
      elapsedSec += sNum("total_elapsed_time") ?? 0;
      dist += sNum("total_distance") ?? 0;
      ascent += sNum("total_ascent") ?? 0;
      cal += sNum("total_calories") ?? 0;
      if (avgP == null) avgP = sNum("avg_power");
      if (np == null) np = sNum("normalized_power");
      if (!ctx.sport && typeof s.sport === "string") ctx.sport = s.sport;
      if (!ctx.subSport && typeof s.sub_sport === "string")
        ctx.subSport = s.sub_sport;
      const sStart = s.start_time;
      if (sStart instanceof Date && ctx.startTimeMs == null) {
        ctx.startTimeMs = sStart.getTime();
      }
    }
    ctx.totalTimerSec = timer || null;
    ctx.totalElapsedSec = elapsedSec || null;
    ctx.deviceTotalDistanceM = dist || null;
    ctx.deviceTotalAscentM = ascent || null;
    ctx.deviceCalories = cal || null;
    ctx.deviceAvgPower = avgP;
    ctx.deviceNormalizedPower = np;
  }
  if (!ctx.sport && sports[0] && typeof sports[0].sport === "string") {
    ctx.sport = sports[0].sport as string;
  }
  if (deviceInfos[0]) {
    const di = deviceInfos[0];
    const manuf = typeof di.manufacturer === "string" ? di.manufacturer : "";
    const prod = typeof di.product_name === "string" ? (di.product_name as string) : "";
    const label = [manuf, prod].filter(Boolean).join(" ").trim();
    if (label) ctx.device = label;
  }
  if (ctx.startTimeMs == null && firstTimeMs != null) ctx.startTimeMs = firstTimeMs;

  return { samples, fit: ctx, format: "fit" };
}

function emptyParsedRide(format: ParsedRide["format"] = "unknown"): ParsedRide {
  return {
    samples: {
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
    format,
  };
}

/**
 * Detect file format and dispatch to the correct decoder.
 * - FIT is detected by extension OR `.FIT` magic bytes at offset 8.
 * - CSV / TXT are decoded via the legacy text parser.
 */
export async function parseRideFile(
  fileName: string,
  data: Buffer,
): Promise<ParsedRide> {
  const lower = fileName.toLowerCase();

  const looksLikeFit =
    lower.endsWith(".fit") ||
    (data.length >= 14 && data.slice(8, 12).toString("ascii") === ".FIT");

  if (looksLikeFit) {
    try {
      return await parseFit(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`FIT_PARSE_FAILED: ${msg}`);
    }
  }

  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return { samples: parseCsv(data.toString("utf8")), format: "csv" };
  }

  // Last-resort: try CSV decoding.
  try {
    const samples = parseCsv(data.toString("utf8"));
    if (samples.t.length > 0) {
      return { samples, format: "csv" };
    }
  } catch {
    // fall through
  }
  return emptyParsedRide("unknown");
}

/**
 * Compute Normalized Power (NP) per Andy Coggan:
 *   1. 30-second rolling average of power
 *   2. Raise to 4th power
 *   3. Average those
 *   4. Take 4th root
 */
function computeNormalizedPower(power: (number | null)[], dtSec: number): number | null {
  const cleanPower: number[] = power.map((p) => (p == null || isNaN(p) ? 0 : p));
  if (cleanPower.length < 30) return null;

  const windowSize = Math.max(1, Math.round(30 / dtSec));
  const rolling: number[] = [];
  let sum = 0;
  for (let i = 0; i < cleanPower.length; i++) {
    sum += cleanPower[i];
    if (i >= windowSize) sum -= cleanPower[i - windowSize];
    if (i >= windowSize - 1) rolling.push(sum / windowSize);
  }
  if (rolling.length === 0) return null;
  let powerSum4 = 0;
  for (const v of rolling) powerSum4 += Math.pow(v, 4);
  const np = Math.pow(powerSum4 / rolling.length, 0.25);
  return Math.round(np);
}

export function computeRideMetrics(samples: RideSamples, ftp: number | null): RideMetrics {
  const n = samples.t.length;
  if (n === 0) {
    return emptyMetrics();
  }

  // Estimate sample interval (seconds)
  let dtSec = 1;
  if (n > 1) {
    const total = samples.t[n - 1] - samples.t[0];
    if (total > 0) dtSec = total / (n - 1);
    if (dtSec <= 0) dtSec = 1;
  }

  const durationSec = Math.max(0, Math.round(samples.t[n - 1] - samples.t[0]) || n);

  // Distance: prefer cumulative distanceM, else integrate speed
  let distanceKm = 0;
  const lastDist = samples.distanceM.filter((d) => d !== null).pop();
  const firstDist = samples.distanceM.find((d) => d !== null);
  if (lastDist != null && firstDist != null) {
    distanceKm = Math.max(0, (lastDist - firstDist) / 1000);
  } else {
    let sumDist = 0;
    for (const v of samples.speedMps) {
      if (v != null && !isNaN(v)) sumDist += v * dtSec;
    }
    distanceKm = sumDist / 1000;
  }

  // Elevation gain (positive deltas)
  let elevation = 0;
  let prevAlt: number | null = null;
  for (const a of samples.altitudeM) {
    if (a == null) continue;
    if (prevAlt != null) {
      const d = a - prevAlt;
      if (d > 0) elevation += d;
    }
    prevAlt = a;
  }

  const validPower = samples.power.filter((p): p is number => p != null && !isNaN(p));
  const avgPower = validPower.length ? Math.round(validPower.reduce((a, b) => a + b, 0) / validPower.length) : null;
  const maxPower = validPower.length ? Math.round(Math.max(...validPower)) : null;
  const normalizedPower = computeNormalizedPower(samples.power, dtSec);

  const validHr = samples.hr.filter((p): p is number => p != null && !isNaN(p));
  const avgHr = validHr.length ? Math.round(validHr.reduce((a, b) => a + b, 0) / validHr.length) : null;
  const maxHr = validHr.length ? Math.round(Math.max(...validHr)) : null;

  const validCad = samples.cadence.filter((p): p is number => p != null && !isNaN(p));
  const avgCadence = validCad.length ? Math.round(validCad.reduce((a, b) => a + b, 0) / validCad.length) : null;

  const avgSpeedKph = durationSec > 0 ? +(distanceKm / (durationSec / 3600)).toFixed(2) : null;

  // Energy expenditure estimation (kJ ≈ avgPower * durationSec / 1000 for steady efforts; works well enough)
  const kj = avgPower != null ? Math.round((avgPower * durationSec) / 1000) : null;

  // IF & TSS
  let intensityFactor: number | null = null;
  let tss: number | null = null;
  if (ftp && ftp > 0 && normalizedPower != null) {
    intensityFactor = +(normalizedPower / ftp).toFixed(3);
    tss = +((durationSec * normalizedPower * intensityFactor) / (ftp * 3600) * 100).toFixed(1);
  }

  // Power zone distribution & SST seconds
  const zoneSeconds = new Array(POWER_ZONES.length).fill(0);
  let sstSeconds = 0;
  if (ftp && ftp > 0) {
    for (const p of samples.power) {
      if (p == null || isNaN(p)) continue;
      const ratio = p / ftp;
      // SST: 88% - 94% of FTP (a common practical band)
      if (ratio >= 0.88 && ratio <= 0.94) sstSeconds += dtSec;
      for (let z = 0; z < POWER_ZONES.length; z++) {
        const zone = POWER_ZONES[z];
        if (ratio >= zone.lo && ratio < zone.hi) {
          zoneSeconds[z] += dtSec;
          break;
        }
      }
    }
  }

  const trainingScore = computeTrainingScore({
    tss,
    durationSec,
    distanceKm,
    elevation,
    sstSeconds,
    intensityFactor,
  });

  return {
    durationSec,
    distanceKm: +distanceKm.toFixed(3),
    elevationM: Math.round(elevation),
    avgPower,
    maxPower,
    normalizedPower,
    avgHr,
    maxHr,
    avgCadence,
    avgSpeedKph,
    kj,
    intensityFactor,
    tss,
    sstSeconds: Math.round(sstSeconds),
    trainingScore,
    zoneSeconds: zoneSeconds.map((s) => Math.round(s)),
  };
}

function emptyMetrics(): RideMetrics {
  return {
    durationSec: 0,
    distanceKm: 0,
    elevationM: 0,
    avgPower: null,
    maxPower: null,
    normalizedPower: null,
    avgHr: null,
    maxHr: null,
    avgCadence: null,
    avgSpeedKph: null,
    kj: null,
    intensityFactor: null,
    tss: null,
    sstSeconds: 0,
    trainingScore: 0,
    zoneSeconds: new Array(POWER_ZONES.length).fill(0),
  };
}

/**
 * A 0-1000 scaled training score that rewards TSS + SST time + endurance,
 * giving riders a single number to chase for motivation.
 */
function computeTrainingScore(p: {
  tss: number | null;
  durationSec: number;
  distanceKm: number;
  elevation: number;
  sstSeconds: number;
  intensityFactor: number | null;
}): number {
  const tssPart = (p.tss ?? 0) * 4;
  const sstPart = (p.sstSeconds / 60) * 3;
  const enduranceBonus = (p.durationSec / 3600) * 12;
  const climbBonus = (p.elevation / 100) * 4;
  const ifBonus = p.intensityFactor != null ? Math.max(0, p.intensityFactor - 0.6) * 200 : 0;
  const raw = tssPart + sstPart + enduranceBonus + climbBonus + ifBonus;
  return Math.max(0, Math.min(1000, Math.round(raw)));
}

/**
 * CTL (Chronic Training Load) - exponentially weighted average of TSS over 42 days.
 * ATL (Acute Training Load) - 7 days. TSB = CTL - ATL (form / freshness).
 */
export function computeLoadMetrics(
  rides: { tss: number | null; rideDate: Date }[],
  reference: Date = new Date(),
) {
  const ctlTimeConstant = 42;
  const atlTimeConstant = 7;
  let ctl = 0;
  let atl = 0;
  const sorted = [...rides].sort((a, b) => a.rideDate.getTime() - b.rideDate.getTime());
  let last = sorted[0]?.rideDate ?? reference;

  for (const r of sorted) {
    const daysSince = Math.max(0, (r.rideDate.getTime() - last.getTime()) / 86400000);
    ctl = ctl * Math.exp(-daysSince / ctlTimeConstant);
    atl = atl * Math.exp(-daysSince / atlTimeConstant);
    const tss = r.tss ?? 0;
    ctl += (tss / ctlTimeConstant);
    atl += (tss / atlTimeConstant);
    last = r.rideDate;
  }

  // Decay to today
  const daysToRef = Math.max(0, (reference.getTime() - last.getTime()) / 86400000);
  ctl = ctl * Math.exp(-daysToRef / ctlTimeConstant);
  atl = atl * Math.exp(-daysToRef / atlTimeConstant);
  const tsb = ctl - atl;

  let fatigueLevel: "fresh" | "optimal" | "elevated" | "high" | "very_high" = "optimal";
  if (tsb > 15) fatigueLevel = "fresh";
  else if (tsb > 5) fatigueLevel = "optimal";
  else if (tsb > -10) fatigueLevel = "elevated";
  else if (tsb > -25) fatigueLevel = "high";
  else fatigueLevel = "very_high";

  return {
    ctl: +ctl.toFixed(1),
    atl: +atl.toFixed(1),
    tsb: +tsb.toFixed(1),
    fatigueLevel,
  };
}
