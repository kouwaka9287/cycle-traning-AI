import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Link, useRoute } from "wouter";

const ZONE_NAMES = [
  "Z1 Recovery",
  "Z2 Endurance",
  "Z3 Tempo",
  "Z4 Threshold",
  "Z5 VO2max",
  "Z6 Anaerobic",
  "Z7 Neuromuscular",
];

const ZONE_COLORS = [
  "bg-cyan-500/30",
  "bg-cyan-400/40",
  "bg-yellow-400/40",
  "bg-orange-400/50",
  "bg-pink-500/60",
  "bg-fuchsia-500/70",
  "bg-red-500/80",
];

function MetricItem({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
}) {
  return (
    <div className="border border-border/60 p-3">
      <div className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-xl font-bold mt-1 font-mono">
        {value ?? "-"}
        {unit && (
          <span className="text-xs text-muted-foreground ml-1">{unit}</span>
        )}
      </div>
    </div>
  );
}

export default function RideDetail() {
  const { t, lang } = useI18n();
  const [, params] = useRoute<{ id: string }>("/rides/:id");
  const id = Number(params?.id);
  const { data: ride, isLoading } = trpc.rides.detail.useQuery(
    { id },
    { enabled: !!id },
  );

  if (isLoading || !ride) {
    return (
      <div className="py-20 text-center font-mono text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin inline" />
      </div>
    );
  }

  const zoneSecondsArr: number[] = Array.isArray(ride.zoneSeconds)
    ? (ride.zoneSeconds as number[])
    : [];
  const totalZone = zoneSecondsArr.reduce(
    (a: number, b: number) => a + (b ?? 0),
    0,
  );

  return (
    <div>
      <Link
        href="/rides"
        className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-primary mb-4"
      >
        <ArrowLeft className="h-3 w-3" /> {t("rideDetail.backToRides")}
      </Link>

      <PageHeader
        title={ride.title || ride.fileName || `Ride #${ride.id}`}
        code={`RIDE-${String(ride.id).padStart(4, "0")}`}
        subtitle={`${new Date(ride.rideDate).toLocaleString(lang === "ja" ? "ja-JP" : lang)} / source: ${ride.source}`}
        actions={
          <DownloadButton id={ride.id} />
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <MetricItem
          label={t("dashboard.duration").toUpperCase()}
          value={Math.round((ride.durationSec ?? 0) / 60)}
          unit="min"
        />
        <MetricItem
          label={t("dashboard.distance").toUpperCase()}
          value={Number(ride.distanceKm).toFixed(1)}
          unit="km"
        />
        <MetricItem label={t("rideDetail.elevGain")} value={ride.elevationM} unit="m" />
        <MetricItem
          label={t("rideDetail.avgSpeed")}
          value={
            ride.avgSpeedKph != null ? Number(ride.avgSpeedKph).toFixed(1) : "-"
          }
          unit="kph"
        />
        <MetricItem label={t("rideDetail.energy")} value={ride.kj} unit="kJ" />
        <MetricItem
          label={t("rideDetail.ftpUsed")}
          value={ride.ftpUsed}
          unit="W"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="tech-card p-6">
          <div className="error-code mb-1">[POW-101]</div>
          <h3 className="text-base font-bold glitch-text-soft uppercase mb-4">
            {t("rideDetail.power")}
          </h3>
          <div className="space-y-3 font-mono text-sm">
            <Row label={t("rideDetail.avgPower")} value={ride.avgPower} unit="W" />
            <Row
              label={t("rideDetail.np")}
              value={ride.normalizedPower}
              unit="W"
              accent
            />
            <Row label={t("rideDetail.maxPower")} value={ride.maxPower} unit="W" />
            <Row
              label={t("rideDetail.if")}
              value={ride.intensityFactor}
              accent
            />
          </div>
        </div>

        <div className="tech-card p-6">
          <div className="error-code mb-1">[BIO-102]</div>
          <h3 className="text-base font-bold glitch-text-soft uppercase mb-4">
            {t("rideDetail.bio")}
          </h3>
          <div className="space-y-3 font-mono text-sm">
            <Row label={t("rideDetail.avgHr")} value={ride.avgHr} unit="bpm" />
            <Row label={t("rideDetail.maxHr")} value={ride.maxHr} unit="bpm" />
            <Row label={t("rideDetail.avgCadence")} value={ride.avgCadence} unit="rpm" />
          </div>
        </div>

        <div className="tech-card p-6 border-primary/30">
          <div className="error-code mb-1">[LOAD-103]</div>
          <h3 className="text-base font-bold glitch-text-soft uppercase mb-4">
            {t("rideDetail.trainingLoad")}
          </h3>
          <div className="space-y-3 font-mono text-sm">
            <Row label="TSS" value={ride.tss} accent unit="pts" />
            <Row
              label={t("rideDetail.sstTime")}
              value={Math.round((ride.sstSeconds ?? 0) / 60)}
              unit="min"
            />
            <div className="pt-3 border-t border-border">
              <div className="text-[0.65rem] uppercase tracking-widest text-muted-foreground mb-1">
                {t("rideDetail.trainingScore")}
              </div>
              <div className="text-3xl font-bold text-primary glitch-text-soft">
                {ride.trainingScore ?? 0}
                <span className="text-xs text-muted-foreground ml-2">/1000</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Zone distribution */}
      {totalZone > 0 && (
        <div className="tech-card p-6 mb-6">
          <div className="error-code mb-1">[ZONE-201]</div>
          <h3 className="text-base font-bold glitch-text-soft uppercase mb-5">
            {t("rideDetail.zoneDistribution")}
          </h3>
          <div className="space-y-2.5">
            {ZONE_NAMES.map((name, i) => {
              const sec = zoneSecondsArr[i] ?? 0;
              const pct = totalZone ? (sec / totalZone) * 100 : 0;
              const min = Math.round(sec / 60);
              return (
                <div key={name} className="flex items-center gap-3">
                  <div className="w-32 sm:w-36 font-mono text-xs text-muted-foreground shrink-0">
                    {name}
                  </div>
                  <div className="flex-1 h-6 bg-secondary/40 border border-border relative overflow-hidden">
                    <div
                      className={`h-full ${ZONE_COLORS[i]} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-20 text-right font-mono text-xs">
                    {min}m ({pct.toFixed(0)}%)
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ride.notes && (
        <div className="tech-card p-6">
          <div className="error-code mb-1">[NOTE-301]</div>
          <h3 className="text-base font-bold glitch-text-soft uppercase mb-3">
            {t("rideDetail.notes")}
          </h3>
          <p className="font-mono text-sm whitespace-pre-wrap text-muted-foreground">
            {ride.notes}
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: number | string | null | undefined;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.7rem] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={`${accent ? "text-accent" : ""} text-sm font-bold`}
      >
        {value ?? "-"}
        {unit && (
          <span className="text-[0.65rem] text-muted-foreground ml-1">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

function DownloadButton({ id }: { id: number }) {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const handleClick = async () => {
    try {
      const r = await utils.rides.signedUrl.fetch({ id });
      window.open(r.url, "_blank");
    } catch {
      // ignore
    }
  };
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      className="font-mono uppercase tracking-widest bg-background"
    >
      <Download className="h-4 w-4" />
      {t("rideDetail.original")}
    </Button>
  );
}
