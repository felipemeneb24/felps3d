-- CreateTable
CREATE TABLE `stock_sales` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockPieceId` INTEGER NULL,
    `productName` VARCHAR(150) NOT NULL,
    `totalCost` DECIMAL(10, 2) NOT NULL,
    `salePrice` DECIMAL(10, 2) NOT NULL,
    `customerName` VARCHAR(150) NULL,
    `customerPhone` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stock_sales` ADD CONSTRAINT `stock_sales_stockPieceId_fkey` FOREIGN KEY (`stockPieceId`) REFERENCES `stock_pieces`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
