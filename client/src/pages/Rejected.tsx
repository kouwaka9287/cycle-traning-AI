import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n";

export default function Rejected() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="tech-card max-w-lg w-full p-8 sm:p-10 space-y-6 border-destructive/50">
        <div className="flex items-start justify-between gap-3">
          <div className="error-code text-destructive">{t("rejected.code")}</div>
          <LanguageSwitcher compact />
        </div>
        <h1 className="text-3xl font-bold glitch-text uppercase tracking-tight">
          {t("rejected.title")}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("rejected.body")}
        </p>
        {user?.rejectionReason && (
          <div className="bg-secondary/40 border border-border p-4 font-mono text-xs">
            <div className="text-[0.6rem] tracking-widest text-destructive mb-2">
              {t("rejected.reason")}
            </div>
            <div>{user.rejectionReason}</div>
          </div>
        )}
        <Button
          onClick={logout}
          variant="outline"
          className="w-full font-mono uppercase tracking-widest"
        >
          {t("common.signOut")}
        </Button>
      </div>
    </div>
  );
}
