import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Cpu, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Register() {
  const { user, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const [realName, setRealName] = useState(user?.realName ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");

  const register = trpc.profile.register.useMutation({
    onSuccess: async () => {
      toast.success("登録が完了しました。ホスト承認をお待ちください。");
      await refresh();
      setLocation("/pending");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!realName.trim() || !displayName.trim()) {
      toast.error("本名と表示名の両方を入力してください");
      return;
    }
    register.mutate({ realName: realName.trim(), displayName: displayName.trim() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="tech-card max-w-lg w-full p-8 sm:p-10 space-y-6"
      >
        <div>
          <div className="error-code mb-2">[INIT-002] IDENTITY_REGISTRATION</div>
          <h1 className="text-3xl font-bold glitch-text uppercase tracking-tight">
            Identity Setup
          </h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            アプリホストの承認を受けるために、本名（実名）と表示名（ニックネーム）を登録してください。
            登録後、ホストが承認するまで全機能はロックされます。
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="realName" className="font-mono text-xs uppercase tracking-widest">
            <span className="text-primary">[01]</span> 本名 / Real Name
          </Label>
          <Input
            id="realName"
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            placeholder="山田 太郎"
            className="font-mono bg-input border-border"
            required
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName" className="font-mono text-xs uppercase tracking-widest">
            <span className="text-accent">[02]</span> 表示名 / Display Name
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="例: NeonRider_42"
            className="font-mono bg-input border-border"
            required
            maxLength={80}
          />
          <p className="text-[0.7rem] font-mono text-muted-foreground">
            アプリ内で他のユーザーに表示される名前です。
          </p>
        </div>

        <div className="text-[0.65rem] font-mono text-muted-foreground tracking-wide border-t border-border pt-4">
          {"> 注意: 本情報はホスト承認の判断材料として使用されます"}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full font-mono uppercase tracking-widest"
          disabled={register.isPending}
        >
          {register.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Cpu className="h-4 w-4" />
          )}
          Submit Identity
        </Button>
      </form>
    </div>
  );
}
