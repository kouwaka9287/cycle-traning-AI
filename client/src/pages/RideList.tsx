import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { Loader2, Trash2, Upload } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function RideList() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const { data: rides, isLoading } = trpc.rides.list.useQuery({});

  const del = trpc.rides.delete.useMutation({
    onSuccess: async () => {
      toast.success(t("common.deleted"));
      await utils.rides.list.invalidate();
      await utils.analytics.summary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title={t("rides.title")}
        code="OPS-002"
        subtitle={t("rides.subtitle")}
        actions={
          <Link href="/rides/upload" asChild>
            <Button size="sm" className="font-mono uppercase tracking-widest">
              <Upload className="h-4 w-4" /> {t("common.upload")}
            </Button>
          </Link>
        }
      />

      <div className="tech-card p-2 sm:p-4">
        {isLoading ? (
          <div className="py-10 text-center font-mono text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          </div>
        ) : rides && rides.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="px-3 py-2">{t("col.date")}</th>
                  <th className="px-3 py-2">{t("col.title")}</th>
                  <th className="px-3 py-2 text-right">{t("col.dur")}(min)</th>
                  <th className="px-3 py-2 text-right">{t("col.dist")}(km)</th>
                  <th className="px-3 py-2 text-right">NP(W)</th>
                  <th className="px-3 py-2 text-right">IF</th>
                  <th className="px-3 py-2 text-right">TSS</th>
                  <th className="px-3 py-2 text-right">SST(min)</th>
                  <th className="px-3 py-2 text-right">{t("col.score")}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {rides.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/40 hover:bg-secondary/20 transition-colors"
                  >
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      {new Date(r.rideDate).toLocaleDateString("ja-JP")}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/rides/${r.id}`}
                        className="hover:text-primary"
                      >
                        {r.title || r.fileName || `Ride #${r.id}`}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {Math.round((r.durationSec ?? 0) / 60)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {Number(r.distanceKm).toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {r.normalizedPower ?? "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {r.intensityFactor ?? "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-accent">
                      {r.tss ?? "-"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs">
                      {Math.round((r.sstSeconds ?? 0) / 60)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-primary font-bold">
                      {r.trainingScore ?? 0}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => {
                          if (confirm(t("common.confirmDelete"))) del.mutate({ id: r.id });
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center font-mono text-sm text-muted-foreground">
            <div className="animate-flicker mb-4">{`> ${t("rides.empty")}`}</div>
            <Link href="/rides/upload" asChild>
              <Button size="sm" className="font-mono uppercase tracking-widest">
                <Upload className="h-4 w-4" /> {t("dashboard.uploadFirst")}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
