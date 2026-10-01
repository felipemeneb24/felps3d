import { NextRequest, NextResponse } from "next/server";
import { sellStockPieces } from "@/lib/stock-sale-service";
import { requireApiAuth } from "@/lib/auth/session";

// Fecha o carrinho: vende várias peças de estoque de uma vez, num pedido só.
// Corpo: { items: [{ pieceId, quantity, unitPrice? }], saleChannel, customerName, ... }
export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  const result = await sellStockPieces(body, items);

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.pieces);
}
