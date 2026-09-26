import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCustomerDTO, normalizePhone } from "@/lib/customer";
import { requireApiAuth } from "@/lib/auth/session";

export async function GET() {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const customers = await prisma.customer.findMany({ orderBy: [{ name: "asc" }] });
  return NextResponse.json(customers.map(toCustomerDTO));
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const body = await request.json();

  const name = String(body.name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const phoneDigits = normalizePhone(phone);

  if (!name) {
    return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
  }
  if (phoneDigits.length < 8) {
    return NextResponse.json({ error: "Informe um telefone válido." }, { status: 400 });
  }

  const existing = await prisma.customer.findUnique({ where: { phoneDigits } });
  if (existing) {
    return NextResponse.json(
      { error: `Esse telefone já está cadastrado para "${existing.name}".` },
      { status: 409 }
    );
  }

  const customer = await prisma.customer.create({ data: { name, phone, phoneDigits } });
  return NextResponse.json(toCustomerDTO(customer), { status: 201 });
}
