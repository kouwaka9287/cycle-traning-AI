import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Activity,
  Bell,
  CalendarDays,
  Cpu,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";

type NavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  code: string;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { label: "DASHBOARD", path: "/", icon: LayoutDashboard, code: "OPS-001" },
  { label: "RIDES", path: "/rides", icon: Activity, code: "OPS-002" },
  { label: "UPLOAD", path: "/rides/upload", icon: Upload, code: "OPS-003" },
  { label: "CALENDAR", path: "/calendar", icon: CalendarDays, code: "OPS-004" },
  { label: "AI COACH", path: "/coach", icon: Sparkles, code: "OPS-005" },
  { label: "SCHEDULES", path: "/schedules", icon: Bell, code: "OPS-006" },
  { label: "PROFILE", path: "/profile", icon: Settings, code: "OPS-007" },
  { label: "ADMIN", path: "/admin", icon: ShieldCheck, code: "ADM-000", adminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-mono text-sm text-primary animate-flicker tech-bracket">
          INITIALIZING SYSTEM
        </div>
      </div>
    );
  }

  if (!user) {
    return <UnauthenticatedScreen />;
  }

  // Authenticated user but profile not registered yet
  const needsRegistration = !user.realName || !user.displayName;
  if (needsRegistration && location !== "/register") {
    return <RedirectTo path="/register" />;
  }

  // Registered but pending approval
  if (
    !needsRegistration &&
    user.approvalStatus === "pending" &&
    location !== "/pending"
  ) {
    return <RedirectTo path="/pending" />;
  }

  // Rejected user
  if (user.approvalStatus === "rejected" && location !== "/rejected") {
    return <RedirectTo path="/rejected" />;
  }

  // Special pages render bare without sidebar
  const bareRoutes = ["/register", "/pending", "/rejected"];
  if (bareRoutes.includes(location)) {
    return <div className="min-h-screen scanlines">{children}</div>;
  }

  const visibleNav = NAV.filter((n) => !n.adminOnly || user.role === "admin");

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="w-64 shrink-0 border-r border-border/60 bg-sidebar/95 backdrop-blur-sm sticky top-0 h-screen flex flex-col">
          <SidebarHeader />
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {visibleNav.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`group block rounded-sm px-3 py-2.5 text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-primary/10 text-primary border-l-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border-l-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span className="font-mono uppercase tracking-wider text-xs">
                      {item.label}
                    </span>
                  </div>
                  <div className="text-[0.6rem] font-mono text-muted-foreground/50 mt-0.5 ml-7">
                    {item.code}
                  </div>
                </Link>
              );
            })}
          </nav>
          <SidebarFooter user={user} onLogout={logout} />
        </aside>
      )}

      {/* Mobile top bar */}
      {isMobile && (
        <div className="fixed top-0 inset-x-0 z-50 h-14 border-b border-border/60 bg-background/95 backdrop-blur flex items-center justify-between px-4">
          <Link href="/" className="text-sm font-bold glitch-text-soft tracking-tight">
            CYCLECOACH
          </Link>
          <button
            aria-label="menu"
            onClick={() => setMobileOpen((s) => !s)}
            className="h-9 w-9 rounded-sm border border-border flex items-center justify-center"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      )}

      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 top-14 z-40 bg-background/95 backdrop-blur"
          onClick={() => setMobileOpen(false)}
        >
          <nav className="px-4 py-4 space-y-1">
            {visibleNav.map((item) => {
              const isActive = location === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`block rounded-sm px-3 py-3 text-sm ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span className="font-mono uppercase tracking-wider text-xs">
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            })}
            <div className="pt-4 mt-4 border-t border-border">
              <button
                onClick={logout}
                className="w-full text-left px-3 py-2 text-sm text-destructive flex items-center gap-3 font-mono"
              >
                <LogOut className="h-4 w-4" /> SIGN OUT
              </button>
            </div>
          </nav>
        </div>
      )}

      <main
        className={`flex-1 ${isMobile ? "pt-14" : ""} relative overflow-hidden`}
      >
        <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function SidebarHeader() {
  return (
    <div className="h-16 border-b border-border/60 px-5 flex items-center justify-between">
      <div>
        <div className="text-base font-bold glitch-text tracking-tight">
          CYCLECOACH
        </div>
        <div className="text-[0.6rem] font-mono text-muted-foreground tracking-widest mt-0.5">
          v1.0.0 // SYS-CTRL
        </div>
      </div>
      <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_var(--color-primary)] animate-flicker" />
    </div>
  );
}

function SidebarFooter({
  user,
  onLogout,
}: {
  user: { displayName?: string | null; name?: string | null; email?: string | null; role: string };
  onLogout: () => void;
}) {
  return (
    <div className="border-t border-border/60 p-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center gap-3 rounded-sm px-2 py-2 hover:bg-secondary/40 transition-colors">
            <Avatar className="h-9 w-9 border border-border bg-secondary">
              <AvatarFallback className="font-mono text-xs bg-transparent">
                {(user.displayName || user.name || "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left min-w-0">
              <div className="text-xs font-medium truncate">
                {user.displayName || user.name || "Pilot"}
              </div>
              <div className="text-[0.6rem] font-mono text-muted-foreground truncate uppercase">
                {user.role === "admin" ? "ADMIN_ROLE" : "ATHLETE"}
              </div>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem asChild>
            <Link href="/profile" className="flex items-center gap-2 w-full">
              <Settings className="h-4 w-4" /> プロフィール設定
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onLogout}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function UnauthenticatedScreen() {
  const utils = trpc.useUtils();
  const [showHost, setShowHost] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const hostLogin = trpc.auth.hostLogin.useMutation({
    onSuccess: async () => {
      toast.success("HOST AUTH OK");
      await utils.auth.me.invalidate();
      // Hard reload so DashboardLayout/AppLayout state is reset cleanly.
      window.location.href = "/";
    },
    onError: (err) => {
      toast.error(err.message || "HOST AUTH FAILED");
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center scanlines">
      <div className="tech-card max-w-md w-full mx-4 p-10 space-y-6">
        <div className="text-xs font-mono text-primary tech-bracket">
          ERR_NO_SESSION_DETECTED
        </div>
        <h1 className="text-3xl font-bold glitch-text uppercase tracking-tight">
          CycleCoach
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          このターミナルへのアクセスには認証が必要です。サイクルコンピューターから抽出した
          データを解析し、トレーニング指令を発行する閉鎖型システムです。
        </p>
        <div className="font-mono text-[0.65rem] text-muted-foreground space-y-1">
          <div>{"> SECURE SHELL: ENABLED"}</div>
          <div>{"> HOST APPROVAL: REQUIRED"}</div>
          <div className="animate-flicker">{"> AWAITING IDENTITY HANDSHAKE..."}</div>
        </div>

        {!showHost ? (
          <>
            <Button
              onClick={() => (window.location.href = getLoginUrl())}
              size="lg"
              className="w-full font-mono uppercase tracking-widest"
            >
              <Cpu className="h-4 w-4" />
              Initiate Login
            </Button>
            <button
              type="button"
              onClick={() => setShowHost(true)}
              className="w-full text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
            >
              {"> HOST DIRECT ACCESS (BYPASS_OAUTH)"}
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!passphrase.trim()) return;
              hostLogin.mutate({ passphrase: passphrase.trim() });
            }}
            className="space-y-3"
          >
            <div className="text-[0.65rem] font-mono text-primary tech-bracket">
              HOST_AUTH_TERMINAL
            </div>
            <Input
              type="password"
              autoFocus
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="PASSPHRASE"
              className="font-mono tracking-widest"
            />
            <p className="text-[0.6rem] font-mono text-muted-foreground leading-relaxed">
              {"> ENTER HOST PASSPHRASE TO BYPASS OAUTH HANDSHAKE"}
              <br />
              {"> CONFIGURED IN: SETTINGS › SECRETS › HOST_LOGIN_PASSPHRASE"}
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={hostLogin.isPending || !passphrase.trim()}
              className="w-full font-mono uppercase tracking-widest"
            >
              <Cpu className="h-4 w-4" />
              {hostLogin.isPending ? "AUTHENTICATING..." : "ENGAGE HOST SESSION"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowHost(false);
                setPassphrase("");
              }}
              className="w-full text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
            >
              {"< BACK TO STANDARD LOGIN"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function RedirectTo({ path }: { path: string }) {
  const [, setLocation] = useLocation();
  if (typeof window !== "undefined" && window.location.pathname !== path) {
    queueMicrotask(() => setLocation(path));
  }
  return null;
}

/* ----- helpers re-exported ----- */
export function PageHeader({
  title,
  subtitle,
  code,
  actions,
}: {
  title: string;
  subtitle?: string;
  code?: string;
  actions?: React.ReactNode;
}) {
  // ensure trpc import remains used downstream
  void trpc;
  return (
    <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
      <div>
        {code && (
          <div className="error-code mb-1.5">{`[${code}] ${new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, ".")}`}</div>
        )}
        <h1 className="text-2xl sm:text-3xl font-bold glitch-text uppercase tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
