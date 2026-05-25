import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bell, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PRESETS = [
  { label: "毎日 朝7時にトレーニング指令", cron: "0 0 7 * * *" },
  { label: "毎週月曜 朝8時に週次プラン", cron: "0 0 8 * * 1" },
  { label: "毎週金曜 夜21時に休養推奨", cron: "0 0 21 * * 5" },
];

export default function Schedules() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.schedules.list.useQuery();
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [cron, setCron] = useState("0 0 7 * * 1");

  const create = trpc.schedules.create.useMutation({
    onSuccess: async () => {
      toast.success("スケジュールを作成しました");
      setLabel("");
      setMessage("");
      await utils.schedules.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const toggle = trpc.schedules.toggle.useMutation({
    onSuccess: () => utils.schedules.list.invalidate(),
  });
  const del = trpc.schedules.delete.useMutation({
    onSuccess: () => utils.schedules.list.invalidate(),
  });

  return (
    <div>
      <PageHeader
        title="Schedules"
        code="OPS-006"
        subtitle="トレーニング指令の自動配信スケジュールを設定します。指定した時刻にホスト宛て通知が送信されます。"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 tech-card p-6 space-y-4 self-start">
          <div className="error-code">[NEW-001]</div>
          <h3 className="font-bold glitch-text-soft uppercase text-base mb-2">
            Add Schedule
          </h3>

          <div>
            <Label className="font-mono text-xs uppercase tracking-widest">
              Label
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例: 朝のトレーニング指令"
              className="font-mono mt-2"
              maxLength={200}
            />
          </div>
          <div>
            <Label className="font-mono text-xs uppercase tracking-widest">
              Cron (秒 分 時 日 月 曜日)
            </Label>
            <Input
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="0 0 7 * * 1"
              className="font-mono mt-2"
            />
            <div className="mt-2 space-y-1">
              {PRESETS.map((p) => (
                <button
                  key={p.cron}
                  type="button"
                  onClick={() => setCron(p.cron)}
                  className="block w-full text-left text-[0.65rem] font-mono text-muted-foreground hover:text-primary"
                >
                  {`> ${p.label} [${p.cron}]`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono text-xs uppercase tracking-widest">
              Message（任意）
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="例: 今日はSST 2x20の予定です"
              className="font-mono mt-2"
              maxLength={2000}
            />
          </div>

          <Button
            onClick={() => {
              if (!label.trim()) {
                toast.error("Labelを入力してください");
                return;
              }
              create.mutate({
                label: label.trim(),
                cronExpression: cron.trim(),
                message: message.trim() || undefined,
              });
            }}
            disabled={create.isPending}
            className="w-full font-mono uppercase tracking-widest"
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create
          </Button>
        </div>

        <div className="lg:col-span-2 tech-card p-6">
          <div className="error-code mb-1">[LIST-002]</div>
          <h3 className="font-bold glitch-text-soft uppercase text-base mb-4">
            Active Schedules
          </h3>

          {isLoading ? (
            <div className="py-8 text-center font-mono text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline" />
            </div>
          ) : list && list.length > 0 ? (
            <div className="space-y-3">
              {list.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-4 border border-border/60 p-3"
                >
                  <Bell className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm truncate">{s.label}</div>
                    <div className="font-mono text-[0.65rem] text-muted-foreground">
                      {s.cronExpression}
                      {s.lastFiredAt && (
                        <>
                          {" / 最終実行: "}
                          {new Date(s.lastFiredAt).toLocaleString("ja-JP")}
                        </>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={Boolean(s.enabled)}
                    onCheckedChange={(checked) =>
                      toggle.mutate({ id: s.id, enabled: checked })
                    }
                  />
                  <button
                    onClick={() => {
                      if (confirm("削除しますか?")) del.mutate({ id: s.id });
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center font-mono text-xs text-muted-foreground">
              {"> NO SCHEDULES CONFIGURED"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
