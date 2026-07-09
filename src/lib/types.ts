// Row types mirroring docs/ontology.md (Phase 1 tables used by the UI).

export const ASSET_CATEGORIES = [
  "appliance",
  "vehicle",
  "system",
  "furniture",
  "electronics",
  "other",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ATTACHMENT_KINDS = [
  "photo",
  "receipt",
  "manual",
  "warranty",
  "contract",
  "other",
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export type Household = {
  id: string;
  name: string;
};

export type Home = {
  id: string;
  household_id: string;
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  purchase_date: string | null;
  purchase_price_cents: number | null;
  year_built: number | null;
  square_feet: number | null;
};

export type Room = {
  id: string;
  home_id: string;
  name: string;
  floor: string | null;
  description: string | null;
};

export type Asset = {
  id: string;
  home_id: string;
  room_id: string | null;
  name: string;
  category: AssetCategory;
  manufacturer: string | null;
  model_number: string | null;
  serial_number: string | null;
  purchase_date: string | null;
  purchase_price_cents: number | null;
  details: Record<string, unknown> | null;
  status: "active" | "disposed";
};

export type Attachment = {
  id: string;
  entity_type: string;
  entity_id: string;
  bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  title: string | null;
  kind: AttachmentKind;
  created_at: string;
};
