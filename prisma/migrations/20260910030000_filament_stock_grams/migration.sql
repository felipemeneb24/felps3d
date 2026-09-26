-- O estoque de filamento passa a ser controlado em gramas (abatido automaticamente
-- quando um pedido é fechado), em vez de número de rolos.

ALTER TABLE `filaments` ADD COLUMN `stockGrams` INTEGER NOT NULL DEFAULT 0;

-- Preenche o estoque em gramas a partir do que já estava cadastrado (rolos x peso do rolo).
UPDATE `filaments` SET `stockGrams` = `stockRolls` * `rollWeightG`;

ALTER TABLE `filaments` DROP COLUMN `stockRolls`;
