"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomerDTO } from "@/lib/customer";

export type LookupStatus = "idle" | "checking" | "found" | "new";

/**
 * Observa um campo de telefone e busca (só leitura, nunca cadastra) se já existe
 * um cliente com esse número. Quando encontra, chama `onFound` com o nome dele.
 */
export function useCustomerLookup(phone: string, onFound: (name: string) => void): LookupStatus {
  const [status, setStatus] = useState<LookupStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;

  useEffect(() => {
    const digits = phone.replace(/\D/g, "");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (digits.length < 8) {
      setStatus("idle");
      return;
    }

    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(phone)}`);
        const data: { customer: CustomerDTO | null } = await res.json();
        if (data.customer) {
          onFoundRef.current(data.customer.name);
          setStatus("found");
        } else {
          setStatus("new");
        }
      } catch {
        setStatus("idle");
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [phone]);

  return status;
}
