import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n";
import { trpc } from "@/lib/trpc";
import { Cpu, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function Register() {
  const { user, refresh } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useI18n();
  const [realName, setRealName] = useState(user?.realName ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");

  const register = trpc.profile.register.useMutation({
    onSuccess: async () => {
      toast.success(t("register.success"));
      await refresh();
      setLocation("/pending");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!realName.trim() || !displayName.trim()) {
      toast.error(t("register.fillBoth"));
      return;
    }
    register.mutate({
      realName: realName.trim(),
      displayName: displayName.trim(),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="tech-card max-w-lg w-full p-8 sm:p-10 space-y-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="error-code mb-2">
              [INIT-002] IDENTITY_REGISTRATION
            </div>
            <h1 className="text-3xl font-bold glitch-text uppercase tracking-tight">
              {t("register.title")}
            </h1>
          </div>
          <LanguageSwitcher compact />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("register.subtitle")}
        </p>

        <div className="space-y-2">
          <Label
            htmlFor="realName"
            className="font-mono text-xs uppercase tracking-widest"
          >
            <span className="text-primary">[01]</span> {t("register.realName")}
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
          <p className="text-[0.7rem] font-mono text-muted-foreground">
            {t("register.realNameHint")}
          </p>
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="displayName"
            className="font-mono text-xs uppercase tracking-widest"
          >
            <span className="text-accent">[02]</span> {t("register.displayName")}
          </Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="NeonRider_42"
            className="font-mono bg-input border-border"
            required
            maxLength={80}
          />
          <p className="text-[0.7rem] font-mono text-muted-foreground">
            {t("register.displayNameHint")}
          </p>
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
          {t("register.submit")}
        </Button>
      </form>
    </div>
  );
}
