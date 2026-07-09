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

// Maintenance schedules allow day/week/month/year cadences.
export const MAINTENANCE_INTERVAL_UNITS = ["day", "week", "month", "year"] as const;
export type MaintenanceIntervalUnit = (typeof MAINTENANCE_INTERVAL_UNITS)[number];

// Recurring commitments only make sense at week/month/year cadence.
export const RECURRING_INTERVAL_UNITS = ["week", "month", "year"] as const;
export type RecurringIntervalUnit = (typeof RECURRING_INTERVAL_UNITS)[number];

// A recurring commitment's category (see ontology.md recurring_expenses).
export const RECURRING_CATEGORIES = [
  "mortgage",
  "utility",
  "insurance",
  "tax",
  "subscription",
  "service",
  "other",
] as const;
export type RecurringCategory = (typeof RECURRING_CATEGORIES)[number];

// A one-time expense's category = the recurring list plus one-off kinds.
export const EXPENSE_CATEGORIES = [
  "purchase",
  "repair",
  "maintenance",
  "utility",
  "service",
  "insurance",
  "tax",
  "subscription",
  "mortgage",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

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

export type MaintenanceSchedule = {
  id: string;
  asset_id: string;
  name: string;
  description: string | null;
  interval_value: number;
  interval_unit: MaintenanceIntervalUnit;
  next_due_on: string | null;
  estimated_cost_cents: number | null;
  is_active: boolean;
};

export type RecurringExpense = {
  id: string;
  household_id: string;
  home_id: string | null;
  asset_id: string | null;
  name: string;
  category: RecurringCategory;
  amount_cents: number;
  interval_value: number;
  interval_unit: RecurringIntervalUnit;
  starts_on: string;
  ends_on: string | null;
};

export type Expense = {
  id: string;
  household_id: string;
  home_id: string | null;
  asset_id: string | null;
  recurring_expense_id: string | null;
  description: string;
  category: ExpenseCategory;
  amount_cents: number;
  incurred_on: string;
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
