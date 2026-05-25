import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const POWER_ZONES = [
  { name: "Z1 Recovery", lo: 0, hi: 0.55 },
  { name: "Z2 Endurance", lo: 0.55, hi: 0.75 },
  { name: "Z3 Tempo", lo: 0.75, hi: 0.88 },
  { name: "Z4 Threshold", lo: 0.88, hi: 1.05 },
  { name: "Z5 VO2max", lo: 1.05, hi: 1.2 },
  { name: "Z6 Anaerobic", lo: 1.2, hi: 1.5 },
  { name: "Z7 Neuromuscular", lo: 1.5, hi: 99 },
];

export default function Profile() {
  const { user, refresh } = useAuth();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [ftp, setFtp] = useState("");

  useEffect(() => {
    if (user) {
      setHeight(user.heightCm ? String(user.heightCm) : "");
      setWeight(user.weightKg ? String(user.weightKg) : "");
      setFtp(user.ftp != null ? String(user.ftp) : "");
    }
  }, [user]);

  const update = trpc.profile.updateMetrics.useMutation({
    onSuccess: async () => {
      toast.success("プロフィールを更新しました");
      await refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({
      heightCm: height ? Number(height) : null,
      weightKg: weight ? Number(weight) : null,
      ftp: ftp ? Number(ftp) : null,
    });
  };

  const ftpNum = Number(ftp) || 0;
  const wpkg =
    user?.weightKg && ftpNum
      ? (ftpNum / Number(user.weightKg)).toFixed(2)
      : weight && ftpNum
      ? (ftpNum / Number(weight)).toFixed(2)
      : "-";

  return (
    <div>
      <PageHeader
        title="Profile"
        code="OPS-007"
        subtitle="身体データとFTP（機能的閾値パワー）を入力すると、ライドの自動解析でTSS / IF / SST / パワーゾーンが正しく計算されます。"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="tech-card p-6 space-y-6">
            <div>
              <div className="error-code mb-1">[ID-001]</div>
              <h2 className="text-lg font-bold glitch-text-soft uppercase tracking-tight">
                Identity
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="font-mono text-xs uppercase tracking-widest">
                  本名
                </Label>
                <Input
                  value={user?.realName ?? ""}
                  disabled
                  className="font-mono mt-2 bg-muted/50"
                />
              </div>
              <div>
                <Label className="font-mono text-xs uppercase tracking-widest">
                  表示名
                </Label>
                <Input
                  value={user?.displayName ?? ""}
                  disabled
                  className="font-mono mt-2 bg-muted/50"
                />
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <div className="error-code mb-1">[BIO-002]</div>
              <h2 className="text-lg font-bold glitch-text-soft uppercase tracking-tight">
                Body Metrics
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="height" className="font-mono text-xs uppercase tracking-widest">
                  身長 (cm)
                </Label>
                <Input
                  id="height"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="172.0"
                  className="font-mono mt-2 bg-input"
                />
              </div>
              <div>
                <Label htmlFor="weight" className="font-mono text-xs uppercase tracking-widest">
                  体重 (kg)
                </Label>
                <Input
                  id="weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="65.0"
                  className="font-mono mt-2 bg-input"
                />
              </div>
              <div>
                <Label htmlFor="ftp" className="font-mono text-xs uppercase tracking-widest">
                  FTP (W)
                </Label>
                <Input
                  id="ftp"
                  type="number"
                  inputMode="numeric"
                  value={ftp}
                  onChange={(e) => setFtp(e.target.value)}
                  placeholder="250"
                  className="font-mono mt-2 bg-input"
                />
              </div>
            </div>

            <div className="bg-secondary/30 border border-border p-4 font-mono text-[0.7rem] text-muted-foreground space-y-1">
              <div>{"> FTPは1時間維持できる平均パワー。20分テスト平均×0.95でも代用可。"}</div>
              <div>{"> 最新FTPを保存すると、以降のライドアップロード時にゾーン計算へ反映されます。"}</div>
            </div>

            <Button
              type="submit"
              disabled={update.isPending}
              className="font-mono uppercase tracking-widest"
            >
              {update.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Profile
            </Button>
          </form>
        </div>

        {/* Power zones preview */}
        <div className="tech-card p-6">
          <div className="error-code mb-1">[ZONE-003]</div>
          <h2 className="text-lg font-bold glitch-text-soft uppercase tracking-tight mb-4">
            Power Zones
          </h2>
          {ftpNum > 0 ? (
            <>
              <div className="text-[0.65rem] font-mono text-muted-foreground mb-4">
                {`> FTP=${ftpNum}W / W/kg=${wpkg}`}
              </div>
              <div className="space-y-1.5">
                {POWER_ZONES.map((z, i) => {
                  const lo = Math.round(z.lo * ftpNum);
                  const hi =
                    z.hi >= 90 ? "+" : Math.round(z.hi * ftpNum);
                  return (
                    <div
                      key={z.name}
                      className="flex items-center justify-between font-mono text-xs border border-border/60 px-3 py-2"
                    >
                      <span
                        className={`${
                          i % 2 === 0 ? "text-primary" : "text-accent"
                        }`}
                      >
                        {z.name}
                      </span>
                      <span className="text-muted-foreground">
                        {lo}-{hi}W
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="py-8 text-center font-mono text-xs text-muted-foreground animate-flicker">
              {"> ENTER FTP TO COMPUTE ZONES"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
