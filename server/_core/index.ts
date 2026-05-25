import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import {
  getScheduleByTaskUid,
  markScheduleFired,
  getUserById,
} from "../db";
import { notifyOwner } from "./notification";
import { invokeLLM } from "./llm";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  // Trust proxy so req.protocol reflects forwarded HTTPS, which is required for
  // Secure; SameSite=None session cookies behind the Manus preview gateway.
  app.set("trust proxy", 1);
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Scheduled (Heartbeat) callback for end-user notification schedules.
  // Triggered by Manus Heartbeat at the cron the user configured.
  app.post("/api/scheduled/coachNotify", async (req, res) => {
    try {
      const sessUser = await sdk.authenticateRequest(req);
      if (!sessUser?.isCron || !sessUser.taskUid) {
        return res.status(403).json({ error: "cron-only" });
      }
      const schedule = await getScheduleByTaskUid(sessUser.taskUid);
      if (!schedule) {
        return res.json({ ok: true, skipped: "orphan" });
      }
      if (!schedule.enabled) {
        return res.json({ ok: true, skipped: "disabled" });
      }

      const owner = await getUserById(schedule.userId);
      const ownerName = owner?.displayName ?? owner?.realName ?? "Athlete";
      const body = schedule.message?.trim() ||
        `> SCHEDULED TRAINING DIRECTIVE\n${schedule.label}\n\nFTPと最近のTSS推移に従ってトレーニングを継続してください。`;

      // Optional: enrich with a short LLM-generated motivational line
      let extra = "";
      try {
        const llm = await invokeLLM({
          messages: [
            { role: "system", content: "You are a terse retro-futuristic cycling coach. Reply within 2 short sentences in Japanese." },
            { role: "user", content: `Athlete: ${ownerName}. Directive: ${schedule.label}. Provide one motivational training reminder.` },
          ],
        });
        extra = String(llm?.choices?.[0]?.message?.content ?? "").slice(0, 280);
      } catch (e) {
        console.warn("[coachNotify] llm failed:", e);
      }

      await notifyOwner({
        title: `[CYCLECOACH] ${schedule.label}`,
        content: `${body}${extra ? "\n\n" + extra : ""}`,
      });
      await markScheduleFired(schedule.id);
      res.json({ ok: true, scheduleId: schedule.id });
    } catch (err) {
      console.error("[coachNotify] failure:", err);
      res.status(500).json({
        error: String((err as Error)?.message ?? err),
        stack: (err as Error)?.stack ?? null,
        context: { url: req.url },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
