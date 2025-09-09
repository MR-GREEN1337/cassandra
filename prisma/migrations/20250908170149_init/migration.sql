-- CreateTable
CREATE TABLE `startup_failures` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_name` VARCHAR(191) NOT NULL,
    `failure_reason` TEXT NULL,
    `summary` TEXT NULL,
    `what_they_did` TEXT NULL,
    `what_went_wrong` TEXT NULL,
    `key_takeaway` TEXT NULL,
    `sourceUrl` VARCHAR(1000) NULL,
    `summary_vector` JSON NULL,

    FULLTEXT INDEX `startup_failures_company_name_idx`(`company_name`),
    FULLTEXT INDEX `startup_failures_failure_reason_idx`(`failure_reason`),
    FULLTEXT INDEX `startup_failures_summary_idx`(`summary`),
    FULLTEXT INDEX `startup_failures_what_went_wrong_idx`(`what_went_wrong`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_frontier` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `query` VARCHAR(191) NOT NULL,
    `status` ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `search_frontier_query_key`(`query`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
