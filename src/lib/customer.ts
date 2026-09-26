import type { Customer } from "@/generated/prisma/client";

/** Deixa só os dígitos do telefone, pra comparar/reconhecer o cliente. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export type CustomerDTO = {
  id: number;
  name: string;
  phone: string;
  createdAt: string;
};

export function toCustomerDTO(customer: Customer): CustomerDTO {
  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    createdAt: customer.createdAt.toISOString(),
  };
}
