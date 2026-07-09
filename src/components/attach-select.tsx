"use client";

// A single picker for optionally attaching money to a home or an asset. The DB
// keeps home_id and asset_id as separate columns; this collapses them into one
// mobile-friendly dropdown whose value is "home:<id>" or "asset:<id>".

export type NamedRef = { id: string; name: string };

const selectClass =
  "h-12 w-full appearance-none rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";

export function AttachSelect({
  homes,
  assets,
  id = "link",
}: {
  homes: NamedRef[];
  assets: NamedRef[];
  id?: string;
}) {
  return (
    <select id={id} name="link" defaultValue="none" className={selectClass}>
      <option value="none">Not attached</option>
      {homes.length > 0 && (
        <optgroup label="Homes">
          {homes.map((h) => (
            <option key={h.id} value={`home:${h.id}`}>
              {h.name}
            </option>
          ))}
        </optgroup>
      )}
      {assets.length > 0 && (
        <optgroup label="Assets">
          {assets.map((a) => (
            <option key={a.id} value={`asset:${a.id}`}>
              {a.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

// Split the combined "link" field into home_id / asset_id on the FormData so the
// server action's existing readers pick them up.
export function applyLink(formData: FormData): {
  home_id: string | null;
  asset_id: string | null;
} {
  const raw = String(formData.get("link") ?? "none");
  let home_id: string | null = null;
  let asset_id: string | null = null;
  if (raw.startsWith("home:")) home_id = raw.slice(5);
  else if (raw.startsWith("asset:")) asset_id = raw.slice(6);
  formData.set("home_id", home_id ?? "");
  formData.set("asset_id", asset_id ?? "");
  return { home_id, asset_id };
}

// Human label for what a link points at, for optimistic rows before refresh.
export function linkLabel(
  home_id: string | null,
  asset_id: string | null,
  homes: NamedRef[],
  assets: NamedRef[]
): string | null {
  if (home_id) return homes.find((h) => h.id === home_id)?.name ?? null;
  if (asset_id) return assets.find((a) => a.id === asset_id)?.name ?? null;
  return null;
}
