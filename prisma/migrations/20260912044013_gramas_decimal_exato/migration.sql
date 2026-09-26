-- Amplia a precisão de gramas pra decimal, pra abater exatamente do estoque
-- quando uma peça de estoque vem de uma placa dividida por várias unidades
-- (ex: 10,3g/peça), em vez de arredondar pro grama inteiro.
-- Só amplia o tipo (Int -> Decimal) — nenhum dado existente é perdido.

-- AlterTable
ALTER TABLE `filaments` MODIFY `stockGrams` DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `stock_piece_items` MODIFY `gramsUsed` DECIMAL(10, 2) NOT NULL;
