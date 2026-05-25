import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
        `アップロード成功 / TSS=${data.metrics.tss ?? "-"} / Score=${data.metrics.trainingScore}`,
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
      toast.error("ファイルを選択してください");
      return;
    }
    if (!user?.ftp) {
      toast.warning(
        "FTP未設定です。プロフィールでFTPを入力するとTSS/SST/ゾーン計算が有効になります",
      );
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
        title="Upload Ride"
        code="OPS-003"
        subtitle="Garmin / Wahoo / Polar / Hammerhead などのサイクルコンピューターから出力された .FIT ファイルをそのままインポートします。パワー/心拍/ケイデンス/GPS/高度/温度を完全解析します。"
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
                    Drop or Click
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {"> Primary: .FIT  ·  Legacy: .CSV / .TXT"}
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
                  ライド日
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
                  タイトル（任意）
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例: 朝練SST 2x20"
                  className="font-mono mt-2"
                  maxLength={200}
                />
              </div>
            </div>
            <div>
              <Label className="font-mono text-xs uppercase tracking-widest">
                メモ（任意）
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="体調 / コース / 機材など"
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
            Analyze & Save
          </Button>
        </div>

        <aside className="tech-card p-6 space-y-4 self-start">
          <div className="error-code">[INFO-002]</div>
          <h3 className="text-base font-bold glitch-text-soft uppercase tracking-tight">
            Format Guide
          </h3>
          <div className="space-y-3 font-mono text-[0.75rem] text-muted-foreground leading-relaxed">
            <div>
              <div className="text-foreground mb-1">{"> .FIT (推奨)"}</div>
              サイクルコンピューターから　そのまま出力した .FIT ファイルをアップロードしてください。
              <span className="text-primary">power</span>,{" "}
              <span className="text-primary">heart_rate</span>,{" "}
              <span className="text-primary">cadence</span>,{" "}
              <span className="text-primary">enhanced_speed</span>,{" "}
              <span className="text-primary">enhanced_altitude</span>,{" "}
              <span className="text-primary">position_lat/long</span>,{" "}
              <span className="text-primary">temperature</span>{" "}
              をデビイス同梱データと同じ精度で取り込みます。Garmin Connect / Wahoo / TrainingPeaks 、いずれのエクスポートもそのまま使えます。
            </div>
            <div>
              <div className="text-foreground mb-1">{"> .CSV (レガシー)"}</div>
              .FIT が入手できない場合のみ、ヘッダ行に{" "}
              <span className="text-primary">time</span>/<span className="text-primary">timestamp</span>{" "}
              と <span className="text-primary">power</span> を含むCSVも受け付けます。
            </div>
            <div className="border-t border-border pt-3 flex items-start gap-2">
              <FileText className="h-3 w-3 mt-0.5 shrink-0" />
              <div>
                FTPが未設定の場合、TSS/IF/パワーゾーン分析が無効になります。
              </div>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
