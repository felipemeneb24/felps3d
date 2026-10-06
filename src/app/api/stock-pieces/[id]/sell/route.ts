import { NextRequest, NextResponse } from "next/server";
import { sellStockPieces } from "@/lib/stock-sale-service";

type Params = { params: Promise<{ id: string }> };

// Venda de um modelo só (direta na feira ou Shopee). A lógica fica em
// sellStockPieces, a mesma usada pelo carrinho (/api/stock-pieces/checkout).
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const pieceId = Number(id);
  if (!Number.isInteger(pieceId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const result = await sellStockPieces(body, [
    { pieceId, quantity: body.quantity, unitPrice: body.salePrice },
  ]);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.pieces[0]);
}
