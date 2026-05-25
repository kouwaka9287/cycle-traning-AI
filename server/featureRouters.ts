import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import * as db from "./db";
import * as analysis from "./rideAnalysis";
import { storagePut, storageGetSignedUrl } from "./storage";
import { invokeLLM } from "./_core/llm";
import {
  createHeartbeatJob,
  deleteHeartbeatJob,
  updateHeartbeatJob,
} from "./_core/heartbeat";
import {
  adminProcedure,
  approvedProcedure,
  protectedProcedure,
  router,
} from "./_core/trpc";

/* -------- Profile / Registration -------- */

export const profileRouter = router({
  register: protectedProcedure
    .input(
      z.object({
        realName: z.string().trim().min(1, "本名を入力してください").max(120),
        displayName: z
          .string()
          .trim()
          .min(1, "表示名を入力してください")
          .max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.registerUserProfile(ctx.user.id, input.realName, input.displayName);
      return { success: true } as const;
    }),

  updateMetrics: approvedProcedure
    .input(
      z.object({
        heightCm: z.number().min(80).max(250).nullable().optional(),
        weightKg: z.number().min(20).max(250).nullable().optional(),
        ftp: z.number().int().min(0).max(800).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db.updateUserProfile(ctx.user.id, {
        heightCm:
          input.heightCm == null ? null : String(input.heightCm),
        weightKg:
          input.weightKg == null ? null : String(input.weightKg),
        ftp: input.ftp ?? null,
      });
      return { success: true } as const;
    }),
});

/* -------- Admin: approval workflow -------- */

export const adminRouter = router({
  listAll: adminProcedure.query(async () => db.listAllManagedUsers()),

  listPending: adminProcedure.query(async () =>
    db.listUsersByApprovalStatus("pending"),
  ),

  approve: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.setUserApproval(input.userId, "approved", ctx.user.openId);
      return { success: true } as const;
    }),

  reject: adminProcedure
    .input(z.object({ userId: z.number(), reason: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      await db.setUserApproval(
        input.userId,
        "rejected",
        ctx.user.openId,
        input.reason,
      );
      return { success: true } as const;
    }),
});

/* -------- Rides: upload, list, detail, delete -------- */

export const rideRouter = router({
  upload: approvedProcedure
    .input(
      z.object({
        fileName: z.string().min(1).max(300),
        fileBase64: z.string().min(1),
        rideDate: z.date().optional(),
        title: z.string().max(200).optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const buf = Buffer.from(input.fileBase64, "base64");
      const lower = input.fileName.toLowerCase();
      const isCsv = lower.endsWith(".csv") || lower.endsWith(".txt");
      const isFit = lower.endsWith(".fit");
      if (!isCsv && !isFit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "対応するファイル形式は CSV / FIT です",
        });
      }

      let parsed: analysis.ParsedRide;
      try {
        parsed = await analysis.parseRideFile(input.fileName, buf);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `FITファイルの解析に失敗しました (${detail})`,
        });
      }
      const { samples, fit: fitCtx } = parsed;

      if (samples.t.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: isFit
            ? "FITファイル内に記録(record)メッセージが見つかりませんでした。GPS/パワー記録が有効か確認してください"
            : "CSVから有効なライドデータを抽出できませんでした",
        });
      }

      const ftp = ctx.user.ftp ?? null;
      const metrics = analysis.computeRideMetrics(samples, ftp);

      // Prefer device-reported totals when available (FIT session message).
      if (fitCtx) {
        if (fitCtx.deviceTotalDistanceM && metrics.distanceKm < 0.01) {
          metrics.distanceKm = +(fitCtx.deviceTotalDistanceM / 1000).toFixed(3);
        }
        if (fitCtx.deviceTotalAscentM && metrics.elevationM === 0) {
          metrics.elevationM = Math.round(fitCtx.deviceTotalAscentM);
        }
        if (fitCtx.totalTimerSec && metrics.durationSec === 0) {
          metrics.durationSec = Math.round(fitCtx.totalTimerSec);
        }
      }

      const rideDate =
        input.rideDate ??
        (fitCtx?.startTimeMs
          ? new Date(fitCtx.startTimeMs)
          : samples.startTimeMs
            ? new Date(samples.startTimeMs)
            : new Date());

      // Persist original to storage - FIT bytes are kept verbatim so we can
      // re-analyse rides later when FTP / algorithms change.
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const rel = `rides/${ctx.user.id}/${rideDate.getTime()}_${safeName}`;
      const { key } = await storagePut(
        rel,
        buf,
        isCsv ? "text/csv" : "application/vnd.ant.fit",
      );

      const id = await db.insertRide({
        userId: ctx.user.id,
        rideDate,
        title: input.title ?? null,
        source: isCsv ? "csv" : "fit",
        fileKey: key,
        fileName: input.fileName,
        durationSec: metrics.durationSec,
        distanceKm: metrics.distanceKm.toFixed(3),
        elevationM: metrics.elevationM,
        avgPower: metrics.avgPower,
        maxPower: metrics.maxPower,
        normalizedPower: metrics.normalizedPower,
        avgHr: metrics.avgHr,
        maxHr: metrics.maxHr,
        avgCadence: metrics.avgCadence,
        avgSpeedKph:
          metrics.avgSpeedKph != null ? metrics.avgSpeedKph.toFixed(2) : null,
        kj: metrics.kj,
        ftpUsed: ftp,
        intensityFactor:
          metrics.intensityFactor != null
            ? metrics.intensityFactor.toFixed(3)
            : null,
        tss: metrics.tss != null ? metrics.tss.toFixed(1) : null,
        sstSeconds: metrics.sstSeconds,
        trainingScore: metrics.trainingScore,
        zoneSeconds: metrics.zoneSeconds,
        notes: input.notes ?? null,
      });

      return { id, metrics } as const;
    }),

  list: approvedProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
        limit: z.number().min(1).max(500).optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) =>
      db.listRidesForUser(ctx.user.id, input ?? {}),
    ),

  detail: approvedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const ride = await db.getRide(input.id, ctx.user.id);
      if (!ride) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ride;
    }),

  signedUrl: approvedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const ride = await db.getRide(input.id, ctx.user.id);
      if (!ride || !ride.fileKey) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const url = await storageGetSignedUrl(ride.fileKey);
      return { url };
    }),

  delete: approvedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await db.deleteRide(input.id, ctx.user.id);
      return { success: true } as const;
    }),
});

/* -------- Analytics summary (week / month / year + load metrics) -------- */

export const analyticsRouter = router({
  summary: approvedProcedure
    .input(
      z.object({
        range: z.enum(["week", "month", "year"]).default("week"),
        anchor: z.date().optional(),
      }).optional(),
    )
    .query(async ({ ctx, input }) => {
      const range = input?.range ?? "week";
      const anchor = input?.anchor ?? new Date();
      const to = new Date(anchor);
      const from = new Date(anchor);
      if (range === "week") from.setDate(from.getDate() - 6);
      else if (range === "month") from.setMonth(from.getMonth() - 1);
      else from.setFullYear(from.getFullYear() - 1);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);

      const agg = await db.aggregateRidesInRange(ctx.user.id, from, to);

      // Load metrics from full ride history (CTL/ATL/TSB)
      const fullRides = await db.listRidesForUser(ctx.user.id, {
        from: new Date(0),
        to: new Date(),
      });
      const load = analysis.computeLoadMetrics(
        fullRides.map((r) => ({
          tss: r.tss != null ? Number(r.tss) : 0,
          rideDate: r.rideDate,
        })),
      );

      // Daily series within window
      const ridesInWindow = fullRides.filter(
        (r) => r.rideDate >= from && r.rideDate <= to,
      );
      return {
        from,
        to,
        range,
        totals: {
          rides: Number(agg?.totalRides ?? 0),
          durationSec: Number(agg?.totalDuration ?? 0),
          distanceKm: Number(agg?.totalDistance ?? 0),
          tss: Number(agg?.totalTss ?? 0),
          score: Number(agg?.totalScore ?? 0),
          sstSeconds: Number(agg?.totalSst ?? 0),
          avgIf: Number(agg?.avgIf ?? 0),
        },
        load,
        rides: ridesInWindow,
      };
    }),
});

/* -------- AI training recommendation -------- */

export const aiRouter = router({
  recommend: approvedProcedure
    .input(
      z
        .object({
          focus: z.string().max(500).optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const last30 = new Date();
      last30.setDate(last30.getDate() - 30);
      const recent = await db.listRidesForUser(ctx.user.id, {
        from: last30,
        to: new Date(),
        limit: 30,
      });

      const fullRides = await db.listRidesForUser(ctx.user.id, {
        from: new Date(0),
        to: new Date(),
      });
      const load = analysis.computeLoadMetrics(
        fullRides.map((r) => ({
          tss: r.tss != null ? Number(r.tss) : 0,
          rideDate: r.rideDate,
        })),
      );

      const ftp = ctx.user.ftp ?? null;
      const weight = ctx.user.weightKg ? Number(ctx.user.weightKg) : null;
      const wpkg = ftp && weight ? +(ftp / weight).toFixed(2) : null;

      const rideSummary = recent
        .slice(0, 14)
        .map(
          (r) =>
            `- ${r.rideDate.toISOString().slice(0, 10)} | ${Math.round((r.durationSec ?? 0) / 60)}分 | ${Number(r.distanceKm).toFixed(1)}km | NP:${r.normalizedPower ?? "-"}W | IF:${r.intensityFactor ?? "-"} | TSS:${r.tss ?? "-"} | SST:${Math.round((r.sstSeconds ?? 0) / 60)}分`,
        )
        .join("\n");

      const systemPrompt = `あなたは経験豊富な自転車競技コーチです。日本語で回答し、具体的な数値とゾーンを必ず示してください。
回答は次の構成のMarkdownで返答してください：
## 現状診断
## 今週のおすすめワークアウト（3-4本、目標パワー帯/IF/所要時間明記）
## 回復・栄養アドバイス
## 注意点
口調はディストピアSF風のクールな分析官のトーンにしてください。`;

      const userPrompt = `# 選手プロファイル
- 表示名: ${ctx.user.displayName ?? ctx.user.name ?? "Unknown"}
- FTP: ${ftp ?? "未設定"}W
- 体重: ${weight ?? "未設定"}kg
- W/kg: ${wpkg ?? "未設定"}
- CTL(慢性負荷): ${load.ctl}
- ATL(急性負荷): ${load.atl}
- TSB(フォーム): ${load.tsb}
- 疲労ステータス: ${load.fatigueLevel}

# 直近30日のライド (最新14件)
${rideSummary || "（データなし）"}

# 要望
${input?.focus ?? "全般的な強化方針と、今週のトレーニングプランを提案してください。"}`;

      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content =
        (result.choices?.[0]?.message?.content as string) ?? "（応答が空です）";

      // persist the plan
      await db.insertTrainingPlan({
        userId: ctx.user.id,
        weekStart: new Date(),
        summary: input?.focus ?? null,
        fullPlan: content,
        fatigueLevel: load.fatigueLevel,
        ctl: load.ctl.toFixed(1),
        atl: load.atl.toFixed(1),
        tsb: load.tsb.toFixed(1),
      });

      return {
        plan: content,
        load,
      };
    }),

  history: approvedProcedure.query(async ({ ctx }) =>
    db.listTrainingPlans(ctx.user.id, 10),
  ),
});

/* -------- Notification scheduling -------- */

export const scheduleRouter = router({
  list: approvedProcedure.query(async ({ ctx }) =>
    db.listNotificationSchedules(ctx.user.id),
  ),

  create: approvedProcedure
    .input(
      z.object({
        label: z.string().min(1).max(200),
        message: z.string().max(2000).optional(),
        cronExpression: z.string().min(9).max(80),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.insertNotificationSchedule({
        userId: ctx.user.id,
        label: input.label,
        message: input.message ?? null,
        cronExpression: input.cronExpression,
        enabled: true,
      });

      try {
        const sessionToken =
          parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        if (sessionToken) {
          const job = await createHeartbeatJob(
            {
              name: `cyclecoach-notify-${id}`,
              cron: input.cronExpression,
              path: "/api/scheduled/coachNotify",
              payload: { scheduleId: id },
              description: input.label,
            },
            sessionToken,
          );
          await db.updateScheduleTaskUid(id, job.taskUid);
        }
      } catch (err) {
        console.warn("[Schedule] heartbeat creation failed:", err);
      }
      return { id } as const;
    }),

  toggle: approvedProcedure
    .input(z.object({ id: z.number(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const list = await db.listNotificationSchedules(ctx.user.id);
      const target = list.find((s) => s.id === input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.scheduleCronTaskUid) {
        try {
          const sessionToken =
            parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
          await updateHeartbeatJob(
            target.scheduleCronTaskUid,
            { enable: input.enabled },
            sessionToken,
          );
        } catch (err) {
          console.warn("[Schedule] toggle failed:", err);
        }
      }
      return { success: true } as const;
    }),

  delete: approvedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const list = await db.listNotificationSchedules(ctx.user.id);
      const target = list.find((s) => s.id === input.id);
      if (target?.scheduleCronTaskUid) {
        try {
          const sessionToken =
            parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
          await deleteHeartbeatJob(
            target.scheduleCronTaskUid,
            sessionToken,
          );
        } catch (err) {
          console.warn("[Schedule] delete cron failed:", err);
        }
      }
      await db.deleteNotificationSchedule(input.id, ctx.user.id);
      return { success: true } as const;
    }),
});
