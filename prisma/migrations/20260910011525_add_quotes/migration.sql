-- CreateTable
CREATE TABLE `quotes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productName` VARCHAR(150) NOT NULL,
    `printTimeHours` DECIMAL(6, 2) NOT NULL,
    `printCostPerHour` DECIMAL(10, 2) NOT NULL,
    `printCost` DECIMAL(10, 2) NOT NULL,
    `filamentCost` DECIMAL(10, 2) NOT NULL,
    `totalCost` DECIMAL(10, 2) NOT NULL,
    `suggestedPrice` DECIMAL(10, 2) NOT NULL,
    `shopeeFee` DECIMAL(10, 2) NOT NULL,
    `shopeeNet` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quoteId` INTEGER NOT NULL,
    `filamentId` INTEGER NULL,
    `colorName` VARCHAR(100) NOT NULL,
    `gramsUsed` INTEGER NOT NULL,
    `pricePerGram` DECIMAL(10, 6) NOT NULL,
    `lineCost` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `quote_items` ADD CONSTRAINT `quote_items_quoteId_fkey` FOREIGN KEY (`quoteId`) REFERENCES `quotes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_items` ADD CONSTRAINT `quote_items_filamentId_fkey` FOREIGN KEY (`filamentId`) REFERENCES `filaments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
