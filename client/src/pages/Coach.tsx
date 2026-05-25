import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

export default function Coach() {
  const [focus, setFocus] = useState("");
  const utils = trpc.useUtils();

  const { data: history } = trpc.ai.history.useQuery();

  const recommend = trpc.ai.recommend.useMutation({
    onSuccess: async () => {
      toast.success("AI解析が完了しました");
      await utils.ai.history.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const latest = recommend.data ?? null;
  const showFromHistory = !latest && history && history.length > 0 ? history[0] : null;
  const displayPlan = latest?.plan ?? showFromHistory?.fullPlan ?? "";
  const load = latest?.load ?? null;

  return (
    <div>
      <PageHeader
        title="AI Coach"
        code="OPS-005"
        subtitle="蓄積されたライドデータ・TSS・疲労度・FTPを根拠に、AIがディストピアSF口調で次のトレーニング指令を提案します。"
        actions={
          <Button
            onClick={() => recommend.mutate({ focus: focus || undefined })}
            disabled={recommend.isPending}
            className="font-mono uppercase tracking-widest"
          >
            {recommend.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate Plan
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="tech-card p-5">
            <div className="error-code mb-2">[INPUT-001]</div>
            <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-2 block">
              Focus / 注力ポイント（任意）
            </label>
            <Textarea
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              rows={6}
              placeholder="例: 7月のクリテリウム向けに無酸素能力を強化したい / FTPを20W上げたい / 週末ロングライドをこなしたい など"
              className="font-mono text-sm bg-input"
              maxLength={500}
            />
            <div className="text-[0.65rem] font-mono text-muted-foreground mt-2">
              {"> 入力なしの場合は総合プランを生成します"}
            </div>
          </div>

          {load && (
            <div className="tech-card p-5">
              <div className="error-code mb-2">[FORM-002]</div>
              <h3 className="font-bold glitch-text-soft uppercase text-sm mb-3">
                Form Snapshot
              </h3>
              <div className="space-y-1.5 font-mono text-xs">
                <Row label="CTL" value={load.ctl} />
                <Row label="ATL" value={load.atl} />
                <Row label="TSB" value={load.tsb} />
                <Row label="FATIGUE" value={load.fatigueLevel} accent />
              </div>
            </div>
          )}

          {history && history.length > 0 && (
            <div className="tech-card p-5">
              <div className="error-code mb-2">[HIST-003]</div>
              <h3 className="font-bold glitch-text-soft uppercase text-sm mb-3">
                Past Plans
              </h3>
              <div className="space-y-2">
                {history.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="border border-border/60 px-2 py-1.5 font-mono text-[0.65rem]"
                  >
                    <div className="text-muted-foreground">
                      {new Date(p.generatedAt).toLocaleDateString("ja-JP")}
                    </div>
                    <div className="truncate">
                      {p.summary || "general"} / TSB={p.tsb}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 tech-card p-6 min-h-[60vh]">
          {recommend.isPending ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="font-mono text-xs text-muted-foreground animate-flicker">
                {"> ANALYZING TRAINING DATA..."}
              </div>
            </div>
          ) : displayPlan ? (
            <article className="prose prose-invert prose-sm max-w-none font-sans
              prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-tight
              prose-h2:text-primary prose-h2:border-b prose-h2:border-border prose-h2:pb-2
              prose-strong:text-accent
              prose-code:text-primary prose-code:bg-secondary/40 prose-code:px-1
              prose-li:my-1
              ">
              <Streamdown>{displayPlan}</Streamdown>
            </article>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Sparkles className="h-10 w-10 text-primary mb-4" />
              <div className="font-mono text-sm text-muted-foreground mb-2">
                {"> NO PLAN GENERATED"}
              </div>
              <div className="font-mono text-xs text-muted-foreground max-w-sm">
                右上の「Generate Plan」を押すと、現在のフォームに合わせたトレーニング指令を発行します。
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number | null;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className={`font-bold ${accent ? "text-accent" : ""}`}>{value ?? "-"}</span>
    </div>
  );
}
