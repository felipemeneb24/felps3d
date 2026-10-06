import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCustomerDTO, normalizePhone } from "@/lib/customer";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  const body = await request.json();
  const data: { name?: string; phone?: string; phoneDigits?: string } = {};

  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
    data.name = name;
  }
  if (body.phone != null) {
    const phone = String(body.phone).trim();
    const phoneDigits = normalizePhone(phone);
    if (phoneDigits.length < 8) {
      return NextResponse.json({ error: "Informe um telefone válido." }, { status: 400 });
    }
    const existing = await prisma.customer.findUnique({ where: { phoneDigits } });
    if (existing && existing.id !== customerId) {
      return NextResponse.json(
        { error: `Esse telefone já está cadastrado para "${existing.name}".` },
        { status: 409 }
      );
    }
    data.phone = phone;
    data.phoneDigits = phoneDigits;
  }

  try {
    const customer = await prisma.customer.update({ where: { id: customerId }, data });
    return NextResponse.json(toCustomerDTO(customer));
  } catch {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) {
    return NextResponse.json({ error: "Id inválido." }, { status: 400 });
  }

  try {
    await prisma.customer.delete({ where: { id: customerId } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }
}
