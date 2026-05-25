import { boolean, decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Approval-gated: every new user starts with status="pending" and must be approved by admin.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),

  // Profile fields - filled on registration
  realName: varchar("realName", { length: 120 }),
  displayName: varchar("displayName", { length: 80 }),
  heightCm: decimal("heightCm", { precision: 5, scale: 1 }),
  weightKg: decimal("weightKg", { precision: 5, scale: 1 }),
  ftp: int("ftp"),

  // Approval workflow
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  approvedAt: timestamp("approvedAt"),
  approvedBy: varchar("approvedBy", { length: 64 }),
  rejectionReason: text("rejectionReason"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Each uploaded ride - parsed summary plus pointer back to original file in storage.
 */
export const rides = mysqlTable("rides", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  rideDate: timestamp("rideDate").notNull(),
  title: varchar("title", { length: 200 }),
  source: mysqlEnum("source", ["csv", "fit", "manual"]).notNull(),

  // Storage reference - original uploaded file
  fileKey: varchar("fileKey", { length: 500 }),
  fileName: varchar("fileName", { length: 300 }),

  // Aggregate metrics
  durationSec: int("durationSec").notNull().default(0),
  distanceKm: decimal("distanceKm", { precision: 8, scale: 3 }).notNull().default("0"),
  elevationM: int("elevationM").default(0),
  avgPower: int("avgPower"),
  maxPower: int("maxPower"),
  normalizedPower: int("normalizedPower"),
  avgHr: int("avgHr"),
  maxHr: int("maxHr"),
  avgCadence: int("avgCadence"),
  avgSpeedKph: decimal("avgSpeedKph", { precision: 6, scale: 2 }),
  kj: int("kj"),

  // Training metrics (computed against user's FTP at upload time)
  ftpUsed: int("ftpUsed"),
  intensityFactor: decimal("intensityFactor", { precision: 4, scale: 3 }),
  tss: decimal("tss", { precision: 6, scale: 1 }),
  sstSeconds: int("sstSeconds").default(0),
  trainingScore: int("trainingScore").default(0),

  // Ride zone time distribution (Z1..Z7) in seconds, JSON array
  zoneSeconds: json("zoneSeconds"),

  notes: text("notes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Ride = typeof rides.$inferSelect;
export type InsertRide = typeof rides.$inferInsert;

/**
 * Saved AI coaching recommendations.
 */
export const trainingPlans = mysqlTable("trainingPlans", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  weekStart: timestamp("weekStart"),
  summary: text("summary"),
  fullPlan: text("fullPlan"),
  fatigueLevel: mysqlEnum("fatigueLevel", ["fresh", "optimal", "elevated", "high", "very_high"]),
  ctl: decimal("ctl", { precision: 6, scale: 1 }),
  atl: decimal("atl", { precision: 6, scale: 1 }),
  tsb: decimal("tsb", { precision: 6, scale: 1 }),
});

export type TrainingPlan = typeof trainingPlans.$inferSelect;
export type InsertTrainingPlan = typeof trainingPlans.$inferInsert;

/**
 * Periodic notifications scheduled via the heartbeat cron system.
 */
export const notificationSchedules = mysqlTable("notificationSchedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  message: text("message"),
  cronExpression: varchar("cronExpression", { length: 80 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastFiredAt: timestamp("lastFiredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationSchedule = typeof notificationSchedules.$inferSelect;
export type InsertNotificationSchedule = typeof notificationSchedules.$inferInsert;
