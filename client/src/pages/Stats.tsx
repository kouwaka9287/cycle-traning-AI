import { PageHeader } from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

type Range = "week" | "month" | "year";

export default function Stats() {
  const { t } = useI18n();
  const [range, setRange] = useState<Range>("week");
  const { data, isLoading } = trpc.analytics.summary.useQuery({ range });

  const buckets = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { tss: number; score: number; count: number }>();
    for (const r of data.rides) {
      let key: string;
      const d = new Date(r.rideDate);
      if (range === "year") key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      else key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const cur = map.get(key) ?? { tss: 0, score: 0, count: 0 };
      cur.tss += Number(r.tss ?? 0);
      cur.score += r.trainingScore ?? 0;
      cur.count += 1;
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ key, ...v }));
  }, [data, range]);

  const maxTss = Math.max(1, ...buckets.map((b) => b.tss));

  return (
    <div>
      <PageHeader
        title={t("stats.title")}
        code="OPS-008"
        subtitle={t("stats.subtitle")}
      />

      <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
        <TabsList className="mb-6 font-mono uppercase tracking-widest">
          <TabsTrigger value="week">{t("stats.week")}</TabsTrigger>
          <TabsTrigger value="month">{t("stats.month")}</TabsTrigger>
          <TabsTrigger value="year">{t("stats.year")}</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading || !data ? (
        <div className="py-10 text-center font-mono text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Stat label={t("calendar.rides")} value={data.totals.rides} />
            <Stat
              label={t("dashboard.distance").toUpperCase()}
              value={`${data.totals.distanceKm.toFixed(0)} km`}
            />
            <Stat
              label={t("dashboard.duration").toUpperCase()}
              value={`${Math.round(data.totals.durationSec / 60)} min`}
            />
            <Stat label={t("stats.totalTss")} value={Math.round(data.totals.tss)} accent />
            <Stat
              label={t("col.score").toUpperCase()}
              value={Math.round(data.totals.score)}
              primary
            />
          </div>

          <div className="tech-card p-6">
            <div className="error-code mb-1">[STAT-401]</div>
            <h3 className="text-base font-bold glitch-text-soft uppercase mb-5">
              {t("stats.tssDistribution")}
            </h3>
            {buckets.length === 0 ? (
              <div className="text-center py-8 font-mono text-xs text-muted-foreground">
                {`> ${t("stats.noData")}`}
              </div>
            ) : (
              <div className="space-y-2">
                {buckets.map((b) => (
                  <div key={b.key} className="flex items-center gap-3">
                    <div className="w-24 font-mono text-[0.65rem] text-muted-foreground shrink-0">
                      {b.key}
                    </div>
                    <div className="flex-1 h-5 bg-secondary/40 border border-border relative">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400/60 to-fuchsia-500/60"
                        style={{ width: `${(b.tss / maxTss) * 100}%` }}
                      />
                    </div>
                    <div className="w-24 text-right font-mono text-xs">
                      {Math.round(b.tss)} TSS
                    </div>
                    <div className="w-16 text-right font-mono text-[0.65rem] text-primary">
                      {b.score}pt
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  primary,
  accent,
}: {
  label: string;
  value: string | number;
  primary?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="tech-card p-4">
      <div className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-2xl font-bold mt-1 ${
          primary ? "text-primary" : accent ? "text-accent" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
