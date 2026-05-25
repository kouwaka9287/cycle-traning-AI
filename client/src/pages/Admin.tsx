import { PageHeader } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "text-yellow-300",
  approved: "text-primary",
  rejected: "text-destructive",
};

export default function Admin() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.listAll.useQuery();
  const [busyId, setBusyId] = useState<number | null>(null);

  const approve = trpc.admin.approve.useMutation({
    onSuccess: async () => {
      toast.success("承認しました");
      await utils.admin.listAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setBusyId(null),
  });
  const reject = trpc.admin.reject.useMutation({
    onSuccess: async () => {
      toast.success("拒否しました");
      await utils.admin.listAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setBusyId(null),
  });

  const pending = users?.filter((u) => u.approvalStatus === "pending") ?? [];
  const others = users?.filter((u) => u.approvalStatus !== "pending") ?? [];

  return (
    <div>
      <PageHeader
        title="Admin Console"
        code="ADM-000"
        subtitle="ホスト権限。登録ユーザーの承認状態を管理します。本名と表示名を確認のうえ、承認/拒否を判断してください。"
      />

      <div className="tech-card p-6 mb-6 border-primary/40">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <div>
            <div className="error-code">[QUEUE-001]</div>
            <h3 className="font-bold glitch-text-soft uppercase text-base">
              Approval Queue ({pending.length})
            </h3>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline" />
          </div>
        ) : pending.length > 0 ? (
          <div className="space-y-3">
            {pending.map((u) => (
              <div
                key={u.id}
                className="border border-border/60 p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <Field label="REAL_NAME" value={u.realName} />
                  <Field label="DISPLAY" value={u.displayName} />
                  <Field label="EMAIL" value={u.email} />
                  <Field
                    label="REGISTERED"
                    value={new Date(u.createdAt).toLocaleString("ja-JP")}
                  />
                </div>
                <div className="flex gap-2 self-end md:self-center">
                  <Button
                    size="sm"
                    onClick={() => {
                      setBusyId(u.id);
                      approve.mutate({ userId: u.id });
                    }}
                    disabled={busyId === u.id}
                    className="font-mono uppercase tracking-widest"
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const reason =
                        prompt("拒否理由 (任意):") ?? undefined;
                      setBusyId(u.id);
                      reject.mutate({
                        userId: u.id,
                        reason: reason || undefined,
                      });
                    }}
                    disabled={busyId === u.id}
                    className="font-mono uppercase tracking-widest bg-background text-destructive border-destructive/50"
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-6 text-center font-mono text-xs text-muted-foreground">
            {"> NO PENDING REQUESTS"}
          </div>
        )}
      </div>

      <div className="tech-card p-6">
        <div className="error-code mb-1">[ROSTER-002]</div>
        <h3 className="font-bold glitch-text-soft uppercase text-base mb-4">
          All Users ({others.length})
        </h3>
        {others.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[0.65rem] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                  <th className="px-3 py-2">Real Name</th>
                  <th className="px-3 py-2">Display</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {others.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-border/40 hover:bg-secondary/20"
                  >
                    <td className="px-3 py-2.5">{u.realName ?? "-"}</td>
                    <td className="px-3 py-2.5">{u.displayName ?? "-"}</td>
                    <td className="px-3 py-2.5">{u.email ?? "-"}</td>
                    <td className="px-3 py-2.5 uppercase">{u.role}</td>
                    <td className="px-3 py-2.5">
                      <span className={STATUS_COLOR[u.approvalStatus]}>
                        {STATUS_LABEL[u.approvalStatus]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {u.approvalStatus === "approved" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-mono uppercase tracking-widest text-destructive border-destructive/50 bg-background"
                          onClick={() => {
                            const reason = prompt("拒否理由 (任意):") ?? undefined;
                            reject.mutate({
                              userId: u.id,
                              reason: reason || undefined,
                            });
                          }}
                        >
                          Revoke
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => approve.mutate({ userId: u.id })}
                          className="font-mono uppercase tracking-widest"
                        >
                          Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center font-mono text-xs text-muted-foreground">
            {"> NO USERS"}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <div className="text-[0.6rem] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="text-foreground truncate">{value || "-"}</div>
    </div>
  );
}
