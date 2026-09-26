-- Adiciona o preço de venda (pode ser diferente do valor sugerido de 2x o custo).
-- Preenche com o valor sugerido nos registros que já existem, pra não perder dado.

ALTER TABLE `quotes` ADD COLUMN `salePrice` DECIMAL(10, 2) NULL;
UPDATE `quotes` SET `salePrice` = `suggestedPrice`;
ALTER TABLE `quotes` MODIFY `salePrice` DECIMAL(10, 2) NOT NULL;

ALTER TABLE `orders` ADD COLUMN `salePrice` DECIMAL(10, 2) NULL;
UPDATE `orders` SET `salePrice` = `suggestedPrice`;
ALTER TABLE `orders` MODIFY `salePrice` DECIMAL(10, 2) NOT NULL;
