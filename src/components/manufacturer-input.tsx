"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { listManufacturerOptions } from "@/lib/knowledge/autocomplete";
import type { AssetCategory } from "@/lib/types";

// Offline manufacturer type-ahead, sourced entirely from the knowledge pack
// (no network call). Shows up to 6 matches once the household starts typing;
// tapping one fills the field. Categories with no manufacturer data
// (furniture/electronics/other) just get a plain text input.
export function ManufacturerInput({
  id,
  name,
  value,
  onChange,
  category,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  category: AssetCategory;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(() => listManufacturerOptions(category), [category]);

  const filtered =
    open && value.trim()
      ? options.filter((o) => o.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 6)
      : [];

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        autoComplete="off"
        className="h-12 text-base"
      />
      {filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {filtered.map((option) => (
            <li key={option}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(option);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
