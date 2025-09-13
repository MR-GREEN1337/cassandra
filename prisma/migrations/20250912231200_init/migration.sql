-- CreateTable
CREATE TABLE `startup_failures` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_name` VARCHAR(191) NOT NULL,
    `failure_reason` VARCHAR(191) NULL,
    `summary` TEXT NULL,
    `what_they_did` TEXT NULL,
    `what_went_wrong` TEXT NULL,
    `key_takeaway` TEXT NULL,
    `source_url` VARCHAR(191) NULL,
    `summary_vector` Vector(1536) NULL,

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
