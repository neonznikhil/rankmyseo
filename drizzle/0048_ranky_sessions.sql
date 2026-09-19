ALTER TABLE `sam_sessions` RENAME TO `ranky_sessions`;
--> statement-breakpoint
DROP INDEX `sam_sessions_project_updated_idx`;
--> statement-breakpoint
CREATE INDEX `ranky_sessions_project_updated_idx` ON `ranky_sessions` (`project_id`,`updated_at`);
--> statement-breakpoint
UPDATE `project_context_sections` SET `updated_by`='ranky' WHERE `updated_by`='sam';
--> statement-breakpoint
UPDATE `project_competitors` SET `updated_by`='ranky' WHERE `updated_by`='sam';
--> statement-breakpoint
UPDATE `project_key_pages` SET `updated_by`='ranky' WHERE `updated_by`='sam';
--> statement-breakpoint
UPDATE `project_research_log` SET `created_by`='ranky' WHERE `created_by`='sam';
