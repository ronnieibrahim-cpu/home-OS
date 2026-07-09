// Money is stored as integer cents (see docs/ontology.md conventions).

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

// "1,234.56" | "$1234.56" | "1234" -> 123456. Empty/invalid -> null.
export function dollarsToCents(input: FormDataEntryValue | null): number | null {
  if (typeof input !== "string") return null;
  const cleaned = input.replace(/[$,\s]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function centsToDollarsInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Empty string -> null for optional text fields.
export function textOrNull(input: FormDataEntryValue | null): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed === "" ? null : trimmed;
}

export function intOrNull(input: FormDataEntryValue | null): number | null {
  if (typeof input !== "string" || input.trim() === "") return null;
  const value = parseInt(input, 10);
  return Number.isFinite(value) ? value : null;
}
