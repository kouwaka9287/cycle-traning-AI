import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { Bell, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PRESET_KEYS = [
  { labelKey: "schedules.preset.daily", cron: "0 0 7 * * *" },
  { labelKey: "schedules.preset.weekly", cron: "0 0 8 * * 1" },
  { labelKey: "schedules.preset.recovery", cron: "0 0 21 * * 5" },
];

export default function Schedules() {
  const { t, lang } = useI18n();
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.schedules.list.useQuery();
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const [cron, setCron] = useState("0 0 7 * * 1");

  const create = trpc.schedules.create.useMutation({
    onSuccess: async () => {
      toast.success(t("schedules.created"));
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
        title={t("schedules.title")}
        code="OPS-006"
        subtitle={t("schedules.subtitle")}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 tech-card p-6 space-y-4 self-start">
          <div className="error-code">[NEW-001]</div>
          <h3 className="font-bold glitch-text-soft uppercase text-base mb-2">
            {t("schedules.add")}
          </h3>

          <div>
            <Label className="font-mono text-xs uppercase tracking-widest">
              {t("schedules.label")}
            </Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t("schedules.labelPlaceholder")}
              className="font-mono mt-2"
              maxLength={200}
            />
          </div>
          <div>
            <Label className="font-mono text-xs uppercase tracking-widest">
              {t("schedules.cron")}
            </Label>
            <Input
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="0 0 7 * * 1"
              className="font-mono mt-2"
            />
            <div className="mt-2 space-y-1">
              {PRESET_KEYS.map((p) => (
                <button
                  key={p.cron}
                  type="button"
                  onClick={() => setCron(p.cron)}
                  className="block w-full text-left text-[0.65rem] font-mono text-muted-foreground hover:text-primary"
                >
                  {`> ${t(p.labelKey)} [${p.cron}]`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="font-mono text-xs uppercase tracking-widest">
              {t("schedules.message")}
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder={t("schedules.messagePlaceholder")}
              className="font-mono mt-2"
              maxLength={2000}
            />
          </div>

          <Button
            onClick={() => {
              if (!label.trim()) {
                toast.error(t("schedules.labelRequired"));
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
            {t("common.create")}
          </Button>
        </div>

        <div className="lg:col-span-2 tech-card p-6">
          <div className="error-code mb-1">[LIST-002]</div>
          <h3 className="font-bold glitch-text-soft uppercase text-base mb-4">
            {t("schedules.active")}
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
                          {` / ${t("schedules.lastFired")}: `}
                          {new Date(s.lastFiredAt).toLocaleString(lang === "ja" ? "ja-JP" : lang)}
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
                      if (confirm(t("common.confirmDelete"))) del.mutate({ id: s.id });
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
              {`> ${t("schedules.empty")}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
