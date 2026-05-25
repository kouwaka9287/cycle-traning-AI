import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertNotificationSchedule,
  InsertRide,
  InsertTrainingPlan,
  InsertUser,
  notificationSchedules,
  rides,
  trainingPlans,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/* -------- Users -------- */

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }

    // Owner is automatically admin AND auto-approved.
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
      values.approvalStatus = "approved";
      updateSet.approvalStatus = "approved";
      values.approvedAt = new Date();
      updateSet.approvedAt = new Date();
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function updateUserProfile(
  userId: number,
  patch: Partial<{
    realName: string;
    displayName: string;
    heightCm: string | null;
    weightKg: string | null;
    ftp: number | null;
  }>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set(patch).where(eq(users.id, userId));
}

export async function listUsersByApprovalStatus(
  status: "pending" | "approved" | "rejected",
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(users)
    .where(eq(users.approvalStatus, status))
    .orderBy(desc(users.createdAt));
}

export async function listAllManagedUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function setUserApproval(
  userId: number,
  status: "approved" | "rejected",
  approvedByOpenId: string,
  rejectionReason?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({
      approvalStatus: status,
      approvedAt: status === "approved" ? new Date() : null,
      approvedBy: approvedByOpenId,
      rejectionReason: rejectionReason ?? null,
    })
    .where(eq(users.id, userId));
}

export async function registerUserProfile(
  userId: number,
  realName: string,
  displayName: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(users)
    .set({
      realName,
      displayName,
      // Always reset to pending on register so admin re-confirms.
      approvalStatus: "pending",
    })
    .where(eq(users.id, userId));
}

/* -------- Rides -------- */

export async function insertRide(ride: InsertRide) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(rides).values(ride);
  return Number((result as any)[0]?.insertId ?? 0);
}

export async function listRidesForUser(
  userId: number,
  opts?: { from?: Date; to?: Date; limit?: number },
) {
  const db = await getDb();
  if (!db) return [];
  const wheres = [eq(rides.userId, userId)];
  if (opts?.from) wheres.push(gte(rides.rideDate, opts.from));
  if (opts?.to) wheres.push(lte(rides.rideDate, opts.to));
  let q = db.select().from(rides).where(and(...wheres)).orderBy(desc(rides.rideDate));
  if (opts?.limit) q = q.limit(opts.limit) as any;
  return q;
}

export async function getRide(rideId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(rides)
    .where(and(eq(rides.id, rideId), eq(rides.userId, userId)))
    .limit(1);
  return result[0];
}

export async function deleteRide(rideId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(rides).where(and(eq(rides.id, rideId), eq(rides.userId, userId)));
}

/* -------- Training plans -------- */

export async function insertTrainingPlan(plan: InsertTrainingPlan) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(trainingPlans).values(plan);
  return Number((result as any)[0]?.insertId ?? 0);
}

export async function listTrainingPlans(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(trainingPlans)
    .where(eq(trainingPlans.userId, userId))
    .orderBy(desc(trainingPlans.generatedAt))
    .limit(limit);
}

/* -------- Notification schedules -------- */

export async function insertNotificationSchedule(s: InsertNotificationSchedule) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(notificationSchedules).values(s);
  return Number((result as any)[0]?.insertId ?? 0);
}

export async function listNotificationSchedules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notificationSchedules)
    .where(eq(notificationSchedules.userId, userId))
    .orderBy(asc(notificationSchedules.createdAt));
}

export async function deleteNotificationSchedule(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .delete(notificationSchedules)
    .where(and(eq(notificationSchedules.id, id), eq(notificationSchedules.userId, userId)));
}

export async function getScheduleByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(notificationSchedules)
    .where(eq(notificationSchedules.scheduleCronTaskUid, taskUid))
    .limit(1);
  return result[0];
}

export async function markScheduleFired(id: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notificationSchedules)
    .set({ lastFiredAt: new Date() })
    .where(eq(notificationSchedules.id, id));
}

export async function updateScheduleTaskUid(id: number, taskUid: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(notificationSchedules)
    .set({ scheduleCronTaskUid: taskUid })
    .where(eq(notificationSchedules.id, id));
}

/* -------- Aggregated analytics -------- */

export async function aggregateRidesInRange(
  userId: number,
  from: Date,
  to: Date,
) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({
      totalRides: sql<number>`COUNT(*)`,
      totalDuration: sql<number>`COALESCE(SUM(${rides.durationSec}), 0)`,
      totalDistance: sql<string>`COALESCE(SUM(${rides.distanceKm}), 0)`,
      totalTss: sql<string>`COALESCE(SUM(${rides.tss}), 0)`,
      totalScore: sql<number>`COALESCE(SUM(${rides.trainingScore}), 0)`,
      totalSst: sql<number>`COALESCE(SUM(${rides.sstSeconds}), 0)`,
      avgIf: sql<string>`COALESCE(AVG(${rides.intensityFactor}), 0)`,
    })
    .from(rides)
    .where(
      and(eq(rides.userId, userId), gte(rides.rideDate, from), lte(rides.rideDate, to)),
    );
  return result[0] ?? null;
}
