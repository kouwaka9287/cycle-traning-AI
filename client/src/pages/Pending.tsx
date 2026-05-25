import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n";
import { Loader2, RefreshCw } from "lucide-react";

export default function Pending() {
  const { user, refresh, logout } = useAuth();
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="tech-card max-w-lg w-full p-8 sm:p-10 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="error-code">{t("pending.code")}</div>
          <LanguageSwitcher compact />
        </div>
        <h1 className="text-3xl font-bold glitch-text uppercase tracking-tight">
          {t("pending.title")}
        </h1>
        <div className="space-y-2 font-mono text-xs text-muted-foreground tracking-wide">
          <div>{`> ID_REAL_NAME : ${user?.realName ?? "-"}`}</div>
          <div>{`> ID_DISPLAY_NAME : ${user?.displayName ?? "-"}`}</div>
          <div>{`> ID_EMAIL : ${user?.email ?? "-"}`}</div>
          <div>
            {`> AUTHORIZATION_STATUS : `}
            <span className="text-primary animate-flicker">PENDING</span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("pending.body")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => refresh()}
            variant="default"
            className="flex-1 font-mono uppercase tracking-widest"
          >
            <RefreshCw className="h-4 w-4" /> {t("pending.refresh")}
          </Button>
          <Button
            onClick={logout}
            variant="outline"
            className="flex-1 font-mono uppercase tracking-widest"
          >
            {t("pending.signOut")}
          </Button>
        </div>

        <div className="border-t border-border pt-4 text-[0.65rem] font-mono text-muted-foreground tracking-wide flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>POLLING HOST AUTHORIZATION CHANNEL...</span>
        </div>
      </div>
    </div>
  );
}
