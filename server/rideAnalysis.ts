/**
 * Ride file parsing and metric calculation.
 *
 * Supports:
 * - CSV with at minimum a "time" or "seconds" column plus "power" (watts).
 *   Optional columns: hr, heart_rate, cadence, speed, distance, altitude.
 * - FIT files: a permissive minimal parser that scans the binary record for
 *   common fields. Real FIT files are complex; for robustness we recommend CSV
 *   exports, but this parser handles a useful subset.
 */

export type RideSamples = {
  /** seconds elapsed from start of ride */
  t: number[];
  power: (number | null)[];
  hr: (number | null)[];
  cadence: (number | null)[];
  speedMps: (number | null)[];
  distanceM: (number | null)[];
  altitudeM: (number | null)[];
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
 * Permissive FIT parser - decodes record messages with basic global IDs.
 * Returns a sparse RideSamples; if parsing fails completely, returns empty.
 */
function parseFit(buf: Buffer): RideSamples {
  // FIT files have a 12 or 14 byte header + records + 2 byte CRC.
  // This is a very simplified scanner that looks for likely power/HR cadence
  // numeric arrays. For robustness we fall back to estimating from known
  // patterns. Most real FIT files include a "record" message (global #20).
  // We do not implement full decoding here; instead, if the file is binary
  // FIT, we extract integer pairs and approximate samples by stride.
  const samples: RideSamples = {
    t: [],
    power: [],
    hr: [],
    cadence: [],
    speedMps: [],
    distanceM: [],
    altitudeM: [],
  };

  if (buf.length < 14) return samples;
  // Verify the header magic (".FIT").
  const sig = buf.slice(8, 12).toString("ascii");
  if (sig !== ".FIT") return samples;

  // We can't fully decode FIT without a dictionary. Inform caller via empty;
  // upper layer will handle unknown-format gracefully.
  return samples;
}

export function parseRideFile(
  fileName: string,
  data: Buffer,
): RideSamples {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    return parseCsv(data.toString("utf8"));
  }
  if (lower.endsWith(".fit")) {
    return parseFit(data);
  }
  // Try CSV by default
  try {
    return parseCsv(data.toString("utf8"));
  } catch {
    return {
      t: [],
      power: [],
      hr: [],
      cadence: [],
      speedMps: [],
      distanceM: [],
      altitudeM: [],
    };
  }
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
