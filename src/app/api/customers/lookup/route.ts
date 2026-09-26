import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCustomerDTO, normalizePhone } from "@/lib/customer";
import { requireApiAuth } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const unauthorized = await requireApiAuth();
  if (unauthorized) return unauthorized;

  const phone = request.nextUrl.searchParams.get("phone") ?? "";
  const phoneDigits = normalizePhone(phone);

  if (phoneDigits.length < 8) {
    return NextResponse.json({ customer: null });
  }

  const customer = await prisma.customer.findUnique({ where: { phoneDigits } });
  return NextResponse.json({ customer: customer ? toCustomerDTO(customer) : null });
}
