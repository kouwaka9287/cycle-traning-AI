import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function Rejected() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="tech-card max-w-lg w-full p-8 sm:p-10 space-y-6 border-destructive/50">
        <div className="error-code text-destructive">
          [STATUS-403] AUTHORIZATION_DENIED
        </div>
        <h1 className="text-3xl font-bold glitch-text uppercase tracking-tight">
          Access Denied
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          ホストによる承認が拒否されました。心当たりがない場合はホストへ直接お問い合わせください。
        </p>
        {user?.rejectionReason && (
          <div className="bg-secondary/40 border border-border p-4 font-mono text-xs">
            <div className="text-[0.6rem] tracking-widest text-destructive mb-2">
              REJECTION_REASON:
            </div>
            <div>{user.rejectionReason}</div>
          </div>
        )}
        <Button
          onClick={logout}
          variant="outline"
          className="w-full font-mono uppercase tracking-widest"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
}
