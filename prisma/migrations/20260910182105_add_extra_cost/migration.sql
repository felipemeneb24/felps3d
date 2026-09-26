-- AlterTable
ALTER TABLE `orders` ADD COLUMN `extraCost` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `extraCostNote` VARCHAR(150) NULL;

-- AlterTable
ALTER TABLE `quotes` ADD COLUMN `extraCost` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `extraCostNote` VARCHAR(150) NULL;

-- AlterTable
ALTER TABLE `stock_pieces` ADD COLUMN `extraCost` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `extraCostNote` VARCHAR(150) NULL;
