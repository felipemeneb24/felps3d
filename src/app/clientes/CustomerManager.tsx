"use client";

import { useState } from "react";
import type { CustomerDTO } from "@/lib/customer";
import { Field, inputClass } from "@/components/form";
import { IconTrash } from "@/components/icons";

export default function CustomerManager({
  initialCustomers,
}: {
  initialCustomers: CustomerDTO[];
}) {
  const [customers, setCustomers] = useState<CustomerDTO[]>(initialCustomers);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    if (!phone.trim()) {
      setError("Informe o telefone do cliente.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Não foi possível cadastrar o cliente.");
      }

      const created: CustomerDTO = await res.json();
      setCustomers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Excluir este cliente?")) return;
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCustomers((prev) => prev.filter((c) => c.id !== id));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-medium">Novo cliente</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome" required>
              <input
                className={inputClass}
                placeholder="Ex: Maria Silva"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Telefone" required>
              <input
                className={inputClass}
                placeholder="Ex: (11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? "Salvando..." : "Cadastrar cliente"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-medium">Clientes cadastrados</h2>
        </div>

        {customers.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nenhum cliente cadastrado ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {customers.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 px-5 py-3">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.phone}</p>
                </div>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                  aria-label="Excluir"
                  title="Excluir"
                >
                  <IconTrash className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
