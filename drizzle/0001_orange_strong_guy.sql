CREATE TABLE `notificationSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`label` varchar(200) NOT NULL,
	`message` text,
	`cronExpression` varchar(80) NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`scheduleCronTaskUid` varchar(65),
	`lastFiredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`rideDate` timestamp NOT NULL,
	`title` varchar(200),
	`source` enum('csv','fit','manual') NOT NULL,
	`fileKey` varchar(500),
	`fileName` varchar(300),
	`durationSec` int NOT NULL DEFAULT 0,
	`distanceKm` decimal(8,3) NOT NULL DEFAULT '0',
	`elevationM` int DEFAULT 0,
	`avgPower` int,
	`maxPower` int,
	`normalizedPower` int,
	`avgHr` int,
	`maxHr` int,
	`avgCadence` int,
	`avgSpeedKph` decimal(6,2),
	`kj` int,
	`ftpUsed` int,
	`intensityFactor` decimal(4,3),
	`tss` decimal(6,1),
	`sstSeconds` int DEFAULT 0,
	`trainingScore` int DEFAULT 0,
	`zoneSeconds` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainingPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`weekStart` timestamp,
	`summary` text,
	`fullPlan` text,
	`fatigueLevel` enum('fresh','optimal','elevated','high','very_high'),
	`ctl` decimal(6,1),
	`atl` decimal(6,1),
	`tsb` decimal(6,1),
	CONSTRAINT `trainingPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `realName` varchar(120);--> statement-breakpoint
ALTER TABLE `users` ADD `displayName` varchar(80);--> statement-breakpoint
ALTER TABLE `users` ADD `heightCm` decimal(5,1);--> statement-breakpoint
ALTER TABLE `users` ADD `weightKg` decimal(5,1);--> statement-breakpoint
ALTER TABLE `users` ADD `ftp` int;--> statement-breakpoint
ALTER TABLE `users` ADD `approvalStatus` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `approvedBy` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `rejectionReason` text;