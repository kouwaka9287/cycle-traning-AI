import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  Award,
  Battery,
  Flame,
  Gauge,
  Loader2,
  Sparkles,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import { Link } from "wouter";

const fatigueLabel: Record<string, string> = {
  fresh: "FRESH / ピーキング可",
  optimal: "OPTIMAL / 練習適正",
  elevated: "ELEVATED / 注意",
  high: "HIGH / 要回復",
  very_high: "VERY HIGH / 強制回復",
};

const fatigueColor: Record<string, string> = {
  fresh: "text-primary",
  optimal: "text-primary",
  elevated: "text-yellow-300",
  high: "text-orange-400",
  very_high: "text-destructive",
};

function MetricBox({
  label,
  code,
  value,
  unit,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  code: string;
  value: string | number;
  unit?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "accent";
}) {
  return (
    <div className="tech-card p-5 relative">
      <div className="flex items-center justify-between mb-4">
        <div className="error-code">{code}</div>
        <Icon
          className={`h-4 w-4 ${
            accent === "primary" ? "text-primary" : "text-accent"
          }`}
        />
      </div>
      <div className="text-[0.65rem] font-mono text-muted-foreground uppercase tracking-widest mb-1">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold glitch-text-soft">{value}</div>
        {unit && (
          <div className="text-xs font-mono text-muted-foreground">{unit}</div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading } = trpc.analytics.summary.useQuery({
    range: "week",
  });
  const { data: recentRides } = trpc.rides.list.useQuery({ limit: 5 });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        code="OPS-001"
        subtitle="直近1週間のトレーニング負荷概要、フォーム指標、AIによる短期推奨を表示します。"
        actions={
          <>
            <Link href="/rides/upload" asChild>
              <Button className="font-mono uppercase tracking-widest" size="sm">
                <Upload className="h-4 w-4" /> Upload Ride
              </Button>
            </Link>
            <Link href="/coach" asChild>
              <Button
                variant="outline"
                size="sm"
                className="font-mono uppercase tracking-widest bg-background"
              >
                <Sparkles className="h-4 w-4" /> AI Coach
              </Button>
            </Link>
          </>
        }
      />

      {isLoading ? (
        <div className="text-muted-foreground font-mono text-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculating metrics...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricBox
              label="WEEK TSS"
              code="MTR-101"
              value={Math.round(summary?.totals.tss ?? 0)}
              unit="pts"
              icon={Flame}
              accent="accent"
            />
            <MetricBox
              label="WEEK SCORE"
              code="MTR-102"
              value={Math.round(summary?.totals.score ?? 0)}
              unit="pts"
              icon={Award}
            />
            <MetricBox
              label="DURATION"
              code="MTR-103"
              value={Math.round((summary?.totals.durationSec ?? 0) / 60)}
              unit="min"
              icon={Activity}
              accent="accent"
            />
            <MetricBox
              label="DISTANCE"
              code="MTR-104"
              value={(Number(summary?.totals.distanceKm) || 0).toFixed(1)}
              unit="km"
              icon={Gauge}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Load metrics */}
            <div className="tech-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="error-code">[LOAD-201]</div>
                  <h2 className="text-lg font-bold glitch-text-soft uppercase tracking-tight mt-1">
                    Performance Form
                  </h2>
                </div>
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <div className="text-[0.6rem] font-mono text-muted-foreground uppercase tracking-widest">
                    CTL
                  </div>
                  <div className="text-2xl font-bold mt-1">
                    {summary?.load.ctl ?? "-"}
                  </div>
                  <div className="text-[0.6rem] font-mono text-muted-foreground">
                    fitness
                  </div>
                </div>
                <div>
                  <div className="text-[0.6rem] font-mono text-muted-foreground uppercase tracking-widest">
                    ATL
                  </div>
                  <div className="text-2xl font-bold mt-1 text-accent">
                    {summary?.load.atl ?? "-"}
                  </div>
                  <div className="text-[0.6rem] font-mono text-muted-foreground">
                    fatigue
                  </div>
                </div>
                <div>
                  <div className="text-[0.6rem] font-mono text-muted-foreground uppercase tracking-widest">
                    TSB
                  </div>
                  <div className="text-2xl font-bold mt-1 text-primary">
                    {summary?.load.tsb ?? "-"}
                  </div>
                  <div className="text-[0.6rem] font-mono text-muted-foreground">
                    form
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <Battery
                    className={`h-4 w-4 ${
                      fatigueColor[summary?.load.fatigueLevel ?? "optimal"]
                    }`}
                  />
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    FATIGUE_STATUS:
                  </span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      fatigueColor[summary?.load.fatigueLevel ?? "optimal"]
                    }`}
                  >
                    {fatigueLabel[summary?.load.fatigueLevel ?? "optimal"]}
                  </span>
                </div>
              </div>
            </div>

            {/* SST + Avg IF */}
            <div className="tech-card p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="error-code">[INTNS-202]</div>
                  <h2 className="text-lg font-bold glitch-text-soft uppercase tracking-tight mt-1">
                    Intensity Profile
                  </h2>
                </div>
                <Zap className="h-5 w-5 text-accent" />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-[0.6rem] font-mono text-muted-foreground uppercase tracking-widest mb-1">
                    SST TIME (week)
                  </div>
                  <div className="text-3xl font-bold">
                    {Math.round((summary?.totals.sstSeconds ?? 0) / 60)}
                  </div>
                  <div className="text-[0.65rem] font-mono text-muted-foreground">
                    分 / FTP 88-94%
                  </div>
                </div>
                <div>
                  <div className="text-[0.6rem] font-mono text-muted-foreground uppercase tracking-widest mb-1">
                    AVG IF (week)
                  </div>
                  <div className="text-3xl font-bold text-accent">
                    {(summary?.totals.avgIf ?? 0).toFixed(2)}
                  </div>
                  <div className="text-[0.65rem] font-mono text-muted-foreground">
                    intensity factor
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-border pt-4 text-[0.65rem] font-mono text-muted-foreground leading-relaxed">
                {"> SST(Sweet Spot)はFTPの88-94%帯域。"}
                <br />
                {"> 短時間で持久力とパワーを底上げする最高効率帯域です。"}
              </div>
            </div>
          </div>

          {/* Recent rides */}
          <div className="tech-card p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="error-code">[LOG-301]</div>
                <h2 className="text-lg font-bold glitch-text-soft uppercase tracking-tight mt-1">
                  Recent Rides
                </h2>
              </div>
              <Link href="/rides" asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono uppercase tracking-widest bg-background"
                >
                  View All
                </Button>
              </Link>
            </div>

            {recentRides && recentRides.length > 0 ? (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                      <th className="px-2 py-2">Date</th>
                      <th className="px-2 py-2">Title</th>
                      <th className="px-2 py-2 text-right">Dur</th>
                      <th className="px-2 py-2 text-right">Dist</th>
                      <th className="px-2 py-2 text-right">NP</th>
                      <th className="px-2 py-2 text-right">IF</th>
                      <th className="px-2 py-2 text-right">TSS</th>
                      <th className="px-2 py-2 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {recentRides.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-border/40 hover:bg-secondary/20 transition-colors"
                      >
                        <td className="px-2 py-2.5 text-xs">
                          {new Date(r.rideDate).toLocaleDateString("ja-JP")}
                        </td>
                        <td className="px-2 py-2.5">
                          <Link
                            href={`/rides/${r.id}`}
                            className="text-foreground hover:text-primary"
                          >
                            {r.title || r.fileName || `Ride #${r.id}`}
                          </Link>
                        </td>
                        <td className="px-2 py-2.5 text-right text-xs">
                          {Math.round((r.durationSec ?? 0) / 60)}m
                        </td>
                        <td className="px-2 py-2.5 text-right text-xs">
                          {Number(r.distanceKm).toFixed(1)}km
                        </td>
                        <td className="px-2 py-2.5 text-right text-xs">
                          {r.normalizedPower ?? "-"}W
                        </td>
                        <td className="px-2 py-2.5 text-right text-xs">
                          {r.intensityFactor ?? "-"}
                        </td>
                        <td className="px-2 py-2.5 text-right text-xs text-accent">
                          {r.tss ?? "-"}
                        </td>
                        <td className="px-2 py-2.5 text-right text-xs text-primary font-bold">
                          {r.trainingScore ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-10 text-center">
                <div className="text-muted-foreground font-mono text-sm mb-4 animate-flicker">
                  {"> NO RIDE LOGS FOUND"}
                </div>
                <Link href="/rides/upload" asChild>
                  <Button size="sm" className="font-mono uppercase tracking-widest">
                    <Upload className="h-4 w-4" /> Upload First Ride
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
