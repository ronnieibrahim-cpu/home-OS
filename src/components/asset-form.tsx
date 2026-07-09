"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToDollarsInput } from "@/lib/format";
import { ASSET_CATEGORIES, type Asset, type Home, type Room } from "@/lib/types";

const selectClass =
  "h-12 w-full appearance-none rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";

// Add + edit form for an asset. Client component so the room dropdown can
// follow the selected home. Native selects give iOS-native pickers.
export function AssetForm({
  action,
  asset,
  homes,
  rooms,
  defaultHomeId,
  defaultRoomId,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  asset?: Asset;
  homes: Home[];
  rooms: Room[];
  defaultHomeId?: string;
  defaultRoomId?: string;
  submitLabel: string;
}) {
  const initialHome = asset?.home_id ?? defaultHomeId ?? homes[0]?.id ?? "";
  const [homeId, setHomeId] = useState(initialHome);
  const roomsForHome = rooms.filter((r) => r.home_id === homeId);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={asset?.name ?? ""}
          placeholder="LG Refrigerator"
          className="h-12 text-base"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          defaultValue={asset?.category ?? "appliance"}
          className={selectClass}
        >
          {ASSET_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c[0].toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="home_id">Home *</Label>
        <select
          id="home_id"
          name="home_id"
          required
          value={homeId}
          onChange={(e) => setHomeId(e.target.value)}
          className={selectClass}
        >
          {homes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="room_id">Room</Label>
        <select
          id="room_id"
          name="room_id"
          defaultValue={asset?.room_id ?? defaultRoomId ?? "none"}
          className={selectClass}
        >
          <option value="none">No room (vehicle, exterior, …)</option>
          {roomsForHome.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="manufacturer">Manufacturer</Label>
          <Input
            id="manufacturer"
            name="manufacturer"
            defaultValue={asset?.manufacturer ?? ""}
            className="h-12 text-base"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="model_number">Model #</Label>
          <Input
            id="model_number"
            name="model_number"
            defaultValue={asset?.model_number ?? ""}
            className="h-12 text-base"
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="serial_number">Serial #</Label>
        <Input
          id="serial_number"
          name="serial_number"
          defaultValue={asset?.serial_number ?? ""}
          className="h-12 text-base"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="purchase_date">Purchase date</Label>
          <Input
            id="purchase_date"
            name="purchase_date"
            type="date"
            defaultValue={asset?.purchase_date ?? ""}
            className="h-12 text-base"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="purchase_price">Price ($)</Label>
          <Input
            id="purchase_price"
            name="purchase_price"
            inputMode="decimal"
            defaultValue={centsToDollarsInput(asset?.purchase_price_cents)}
            placeholder="899.00"
            className="h-12 text-base"
          />
        </div>
      </div>

      {asset && (
        <div className="grid gap-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={asset.status}
            className={selectClass}
          >
            <option value="active">Active</option>
            <option value="disposed">Disposed (sold / trashed)</option>
          </select>
        </div>
      )}

      <Button type="submit" size="lg" className="mt-2 h-12">
        {submitLabel}
      </Button>
    </form>
  );
}
