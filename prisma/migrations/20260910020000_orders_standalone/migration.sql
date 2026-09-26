-- Orçamentos passam a ter nome/telefone de cliente opcionais (anotação rápida).
ALTER TABLE `quotes`
  ADD COLUMN `customerName` VARCHAR(150) NULL,
  ADD COLUMN `customerPhone` VARCHAR(30) NULL;

-- Pedidos passam a guardar sua própria cópia dos dados de custo do orçamento
-- (o orçamento é apagado quando o pedido é fechado) e um status de andamento.
ALTER TABLE `orders`
  ADD COLUMN `productName` VARCHAR(150) NULL,
  ADD COLUMN `printTimeHours` DECIMAL(6, 2) NULL,
  ADD COLUMN `printCostPerHour` DECIMAL(10, 2) NULL,
  ADD COLUMN `printCost` DECIMAL(10, 2) NULL,
  ADD COLUMN `filamentCost` DECIMAL(10, 2) NULL,
  ADD COLUMN `totalCost` DECIMAL(10, 2) NULL,
  ADD COLUMN `suggestedPrice` DECIMAL(10, 2) NULL,
  ADD COLUMN `shopeeFee` DECIMAL(10, 2) NULL,
  ADD COLUMN `shopeeNet` DECIMAL(10, 2) NULL,
  ADD COLUMN `status` ENUM('PENDENTE', 'EM_PRODUCAO', 'PRONTO_PARA_ENTREGA', 'FINALIZADO') NOT NULL DEFAULT 'PENDENTE';

-- Preenche os pedidos já existentes com os dados do orçamento que os originou.
UPDATE `orders` o
JOIN `quotes` q ON q.id = o.quoteId
SET
  o.productName = q.productName,
  o.printTimeHours = q.printTimeHours,
  o.printCostPerHour = q.printCostPerHour,
  o.printCost = q.printCost,
  o.filamentCost = q.filamentCost,
  o.totalCost = q.totalCost,
  o.suggestedPrice = q.suggestedPrice,
  o.shopeeFee = q.shopeeFee,
  o.shopeeNet = q.shopeeNet;

-- Agora que estão preenchidas, essas colunas passam a ser obrigatórias.
ALTER TABLE `orders`
  MODIFY `productName` VARCHAR(150) NOT NULL,
  MODIFY `printTimeHours` DECIMAL(6, 2) NOT NULL,
  MODIFY `printCostPerHour` DECIMAL(10, 2) NOT NULL,
  MODIFY `printCost` DECIMAL(10, 2) NOT NULL,
  MODIFY `filamentCost` DECIMAL(10, 2) NOT NULL,
  MODIFY `totalCost` DECIMAL(10, 2) NOT NULL,
  MODIFY `suggestedPrice` DECIMAL(10, 2) NOT NULL,
  MODIFY `shopeeFee` DECIMAL(10, 2) NOT NULL,
  MODIFY `shopeeNet` DECIMAL(10, 2) NOT NULL;

-- CreateTable: cópia dos itens de filamento do orçamento, presa ao pedido.
CREATE TABLE `order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `filamentId` INTEGER NULL,
    `colorName` VARCHAR(100) NOT NULL,
    `gramsUsed` INTEGER NOT NULL,
    `pricePerGram` DECIMAL(10, 6) NOT NULL,
    `lineCost` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_filamentId_fkey` FOREIGN KEY (`filamentId`) REFERENCES `filaments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Copia os itens dos orçamentos já fechados para dentro do pedido correspondente.
INSERT INTO `order_items` (`orderId`, `filamentId`, `colorName`, `gramsUsed`, `pricePerGram`, `lineCost`)
SELECT o.id, qi.filamentId, qi.colorName, qi.gramsUsed, qi.pricePerGram, qi.lineCost
FROM `quote_items` qi
JOIN `orders` o ON o.quoteId = qi.quoteId;

-- Um orçamento que já virou pedido deixa de existir como orçamento
-- (quote_items junto, por causa do ON DELETE CASCADE).
DELETE FROM `quotes` WHERE id IN (SELECT quoteId FROM `orders`);

-- Pedido deixa de referenciar orçamento: agora é totalmente independente.
ALTER TABLE `orders` DROP FOREIGN KEY `orders_quoteId_fkey`;
ALTER TABLE `orders` DROP INDEX `orders_quoteId_key`;
ALTER TABLE `orders` DROP COLUMN `quoteId`;
