import type { LookupStatus } from "@/hooks/useCustomerLookup";

export default function PhoneLookupHint({
  status,
  willRegister,
}: {
  status: LookupStatus;
  /** true quando, ao confirmar essa ação, um cliente novo será cadastrado automaticamente. */
  willRegister?: boolean;
}) {
  if (status === "checking") {
    return <p className="text-xs text-muted-foreground">Procurando cliente...</p>;
  }
  if (status === "found") {
    return (
      <p className="text-xs text-accent">✓ Cliente já cadastrado — nome preenchido automaticamente.</p>
    );
  }
  if (status === "new") {
    return (
      <p className="text-xs text-muted-foreground">
        {willRegister
          ? "Telefone novo — esse cliente será cadastrado automaticamente."
          : "Telefone novo, ainda sem cadastro."}
      </p>
    );
  }
  return null;
}
