import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { CloudUpload, FileText, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      const idx = r.indexOf(",");
      resolve(idx >= 0 ? r.slice(idx + 1) : r);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function RideUpload() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const utils = trpc.useUtils();
  const upload = trpc.rides.upload.useMutation({
    onSuccess: async (data) => {
      toast.success(
        `${t("upload.success")} / TSS=${data.metrics.tss ?? "-"} / Score=${data.metrics.trainingScore}`,
      );
      await utils.rides.list.invalidate();
      await utils.analytics.summary.invalidate();
      setLocation(`/rides/${data.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error(t("upload.selectFile"));
      return;
    }
    if (!user?.ftp) {
      toast.warning(t("upload.ftpWarning"));
    }
    const fileBase64 = await fileToBase64(file);
    upload.mutate({
      fileName: file.name,
      fileBase64,
      title: title.trim() || undefined,
      notes: notes.trim() || undefined,
      rideDate: date ? new Date(date) : undefined,
    });
  };

  return (
    <div>
      <PageHeader
        title={t("upload.title")}
        code="OPS-003"
        subtitle={t("upload.subtitle")}
      />

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div className="lg:col-span-2 space-y-6">
          <div
            className="tech-card p-6 cursor-pointer hover:border-primary transition-colors"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.fit,.txt"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-14 w-14 rounded-sm border border-primary/40 flex items-center justify-center mb-4 bg-primary/5">
                <CloudUpload className="h-7 w-7 text-primary" />
              </div>
              {file ? (
                <>
                  <div className="font-mono text-sm text-foreground">
                    {file.name}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </>
              ) : (
                <>
                  <div className="text-base font-bold uppercase tracking-widest mb-2">
                    {t("upload.dropOrClick")}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {`> ${t("upload.acceptHint")}`}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="tech-card p-6 space-y-4">
            <div className="error-code">[META-001]</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="font-mono text-xs uppercase tracking-widest">
                  {t("upload.rideDate")}
                </Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="font-mono mt-2"
                />
              </div>
              <div>
                <Label className="font-mono text-xs uppercase tracking-widest">
                  {t("upload.titleOptional")}
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("upload.titlePlaceholder")}
                  className="font-mono mt-2"
                  maxLength={200}
                />
              </div>
            </div>
            <div>
              <Label className="font-mono text-xs uppercase tracking-widest">
                {t("upload.notesOptional")}
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={t("upload.notesPlaceholder")}
                className="font-mono mt-2"
                maxLength={2000}
              />
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={upload.isPending || !file}
            className="font-mono uppercase tracking-widest"
          >
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CloudUpload className="h-4 w-4" />
            )}
            {t("upload.analyzeSave")}
          </Button>
        </div>

        <aside className="tech-card p-6 space-y-4 self-start">
          <div className="error-code">[INFO-002]</div>
          <h3 className="text-base font-bold glitch-text-soft uppercase tracking-tight">
            {t("upload.formatGuide")}
          </h3>
          <div className="space-y-3 font-mono text-[0.75rem] text-muted-foreground leading-relaxed">
            <div>
              <div className="text-foreground mb-1">{`> .FIT (${t("common.recommended")})`}</div>
              {t("upload.fitDescription")}
            </div>
            <div>
              <div className="text-foreground mb-1">{`> .CSV (${t("common.legacy")})`}</div>
              {t("upload.csvDescription")}
            </div>
            <div className="border-t border-border pt-3 flex items-start gap-2">
              <FileText className="h-3 w-3 mt-0.5 shrink-0" />
              <div>{t("upload.ftpRequired")}</div>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
