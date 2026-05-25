import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export default function CalendarView() {
  const [anchor, setAnchor] = useState(() => new Date());

  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = useMemo(() => {
    const arr: Date[] = [];
    const d = new Date(gridStart);
    while (d <= gridEnd) {
      arr.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return arr;
  }, [gridStart, gridEnd]);

  const { data: rides, isLoading } = trpc.rides.list.useQuery({
    from: gridStart,
    to: gridEnd,
  });

  const ridesByDay = useMemo(() => {
    const m = new Map<string, typeof rides>();
    if (!rides) return m;
    for (const r of rides) {
      const key = format(new Date(r.rideDate), "yyyy-MM-dd");
      const arr = m.get(key) ?? [];
      arr.push(r);
      m.set(key, arr);
    }
    return m;
  }, [rides]);

  const monthlyTotals = useMemo(() => {
    if (!rides)
      return { tss: 0, score: 0, dur: 0, dist: 0, sst: 0, count: 0 };
    let tss = 0,
      score = 0,
      dur = 0,
      dist = 0,
      sst = 0,
      count = 0;
    for (const r of rides) {
      if (!isSameMonth(new Date(r.rideDate), anchor)) continue;
      tss += Number(r.tss ?? 0);
      score += r.trainingScore ?? 0;
      dur += r.durationSec ?? 0;
      dist += Number(r.distanceKm ?? 0);
      sst += r.sstSeconds ?? 0;
      count += 1;
    }
    return { tss, score, dur, dist, sst, count };
  }, [rides, anchor]);

  return (
    <div>
      <PageHeader
        title="Training Calendar"
        code="OPS-004"
        subtitle="月単位のトレーニングログをスキャン。各日のトレーニングスコアとTSSを色強度で可視化します。"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnchor((d) => subMonths(d, 1))}
              className="bg-background"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="font-mono text-sm uppercase tracking-widest min-w-[10ch] text-center">
              {format(anchor, "yyyy.MM")}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnchor((d) => addMonths(d, 1))}
              className="bg-background"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnchor(new Date())}
              className="bg-background font-mono uppercase tracking-widest"
            >
              Today
            </Button>
          </div>
        }
      />

      {/* Monthly totals strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Stat label="RIDES" value={monthlyTotals.count} />
        <Stat label="DISTANCE" value={`${monthlyTotals.dist.toFixed(0)}km`} />
        <Stat label="DURATION" value={`${Math.round(monthlyTotals.dur / 60)}m`} />
        <Stat label="TSS" value={Math.round(monthlyTotals.tss)} accent />
        <Stat
          label="SST"
          value={`${Math.round(monthlyTotals.sst / 60)}m`}
        />
        <Stat
          label="SCORE"
          value={Math.round(monthlyTotals.score)}
          primary
        />
      </div>

      {/* Calendar grid */}
      <div className="tech-card p-3 sm:p-5">
        {isLoading && (
          <div className="text-center py-2 font-mono text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin inline" />
          </div>
        )}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-foreground text-center py-1"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayRides = ridesByDay.get(key) ?? [];
            const tss = dayRides.reduce((s, r) => s + Number(r.tss ?? 0), 0);
            const score = dayRides.reduce(
              (s, r) => s + (r.trainingScore ?? 0),
              0,
            );
            const inMonth = isSameMonth(day, anchor);
            const today = isSameDay(day, new Date());
            const intensity = Math.min(1, tss / 100);

            return (
              <div
                key={key}
                className={`relative min-h-[88px] sm:min-h-[110px] border ${
                  today
                    ? "border-primary"
                    : "border-border/50"
                } ${inMonth ? "bg-secondary/10" : "bg-secondary/0 opacity-40"} p-1.5 transition-colors`}
                style={
                  intensity > 0
                    ? {
                        backgroundImage: `linear-gradient(135deg, oklch(0.85 0.18 200 / ${
                          intensity * 0.15
                        }), oklch(0.65 0.28 340 / ${intensity * 0.15}))`,
                      }
                    : undefined
                }
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`text-xs font-mono ${
                      today ? "text-primary font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  {tss > 0 && (
                    <div className="text-[0.55rem] font-mono text-accent font-bold">
                      {Math.round(tss)}TSS
                    </div>
                  )}
                </div>

                <div className="mt-1 space-y-0.5">
                  {dayRides.slice(0, 2).map((r) => (
                    <Link key={r.id} href={`/rides/${r.id}`}>
                      <a
                        className="block truncate text-[0.6rem] font-mono px-1 py-0.5 bg-primary/10 border-l-2 border-primary text-foreground hover:bg-primary/20"
                        title={r.title || r.fileName || ""}
                      >
                        {r.title || r.fileName || `R#${r.id}`}
                      </a>
                    </Link>
                  ))}
                  {dayRides.length > 2 && (
                    <div className="text-[0.55rem] font-mono text-muted-foreground">
                      +{dayRides.length - 2} more
                    </div>
                  )}
                </div>

                {score > 0 && (
                  <div className="absolute bottom-1 right-1 text-[0.55rem] font-mono text-primary font-bold">
                    {score}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-[0.65rem] font-mono text-muted-foreground">
        <span>{"> Low TSS"}</span>
        <div className="flex gap-1">
          {[0.1, 0.3, 0.5, 0.7, 1.0].map((v, i) => (
            <div
              key={i}
              className="h-3 w-6 border border-border"
              style={{
                backgroundImage: `linear-gradient(135deg, oklch(0.85 0.18 200 / ${
                  v * 0.4
                }), oklch(0.65 0.28 340 / ${v * 0.4}))`,
              }}
            />
          ))}
        </div>
        <span>{"High TSS <"}</span>
      </div>
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
    <div className="tech-card p-3">
      <div className="text-[0.6rem] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-xl font-bold mt-1 ${
          primary ? "text-primary" : accent ? "text-accent" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
