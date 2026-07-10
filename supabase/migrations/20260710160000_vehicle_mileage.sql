-- Migration 7/7: mileage-aware vehicle maintenance (ADR-014)
-- Two small additive columns so a vehicle's maintenance can be due by
-- odometer reading as well as by calendar. Both are optional and only
-- meaningful for vehicles; everything else keeps working unchanged.
--
-- The vehicle's current odometer reading itself is NOT a new column — it
-- stays in the existing assets.details JSONB (details.current_mileage /
-- details.current_mileage_asof), same convention as details.powertrain
-- (ADR-012). See docs/ontology.md and ADR-014 for the full reasoning.

-- interval_miles: an optional mileage-based cadence alongside the existing
-- calendar cadence (interval_value + interval_unit). NULL means calendar-only.
alter table public.maintenance_schedules
  add column interval_miles integer check (interval_miles > 0);

-- mileage: the odometer reading at time of service. Also the household's most
-- reliable mileage data point (captured at a real event), used to estimate
-- the vehicle's miles/year for projecting mileage-based due dates.
alter table public.maintenance_logs
  add column mileage integer check (mileage >= 0);
