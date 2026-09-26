-- CreateTable
CREATE TABLE `filaments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `colorName` VARCHAR(100) NOT NULL,
    `material` VARCHAR(50) NULL,
    `brand` VARCHAR(100) NULL,
    `pricePerKg` DECIMAL(10, 2) NOT NULL,
    `rollWeightG` INTEGER NOT NULL,
    `stockRolls` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
