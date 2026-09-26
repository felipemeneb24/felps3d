/*
  Warnings:

  - You are about to drop the `stock_sales` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `stock_sales` DROP FOREIGN KEY `stock_sales_stockPieceId_fkey`;

-- AlterTable
ALTER TABLE `orders` MODIFY `customerPhone` VARCHAR(30) NULL;

-- DropTable
DROP TABLE `stock_sales`;
