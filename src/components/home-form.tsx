import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToDollarsInput } from "@/lib/format";
import type { Home } from "@/lib/types";

// Add + edit form for a home. `action` is a pre-bound server action.
export function HomeForm({
  action,
  home,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  home?: Home;
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Name *" name="name">
        <Input
          id="name"
          name="name"
          required
          defaultValue={home?.name ?? ""}
          placeholder="Main house"
          className="h-12 text-base"
        />
      </Field>

      <Field label="Address" name="address_line1">
        <Input
          id="address_line1"
          name="address_line1"
          defaultValue={home?.address_line1 ?? ""}
          placeholder="Street address"
          autoComplete="address-line1"
          className="h-12 text-base"
        />
      </Field>
      <Field label="Address line 2" name="address_line2">
        <Input
          id="address_line2"
          name="address_line2"
          defaultValue={home?.address_line2 ?? ""}
          autoComplete="address-line2"
          className="h-12 text-base"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="City" name="city">
          <Input
            id="city"
            name="city"
            defaultValue={home?.city ?? ""}
            className="h-12 text-base"
          />
        </Field>
        <Field label="State" name="state">
          <Input
            id="state"
            name="state"
            defaultValue={home?.state ?? ""}
            className="h-12 text-base"
          />
        </Field>
        <Field label="ZIP" name="postal_code">
          <Input
            id="postal_code"
            name="postal_code"
            defaultValue={home?.postal_code ?? ""}
            inputMode="numeric"
            className="h-12 text-base"
          />
        </Field>
        <Field label="Country" name="country">
          <Input
            id="country"
            name="country"
            defaultValue={home?.country ?? ""}
            className="h-12 text-base"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Purchase date" name="purchase_date">
          <Input
            id="purchase_date"
            name="purchase_date"
            type="date"
            defaultValue={home?.purchase_date ?? ""}
            className="h-12 text-base"
          />
        </Field>
        <Field label="Purchase price ($)" name="purchase_price">
          <Input
            id="purchase_price"
            name="purchase_price"
            inputMode="decimal"
            defaultValue={centsToDollarsInput(home?.purchase_price_cents)}
            placeholder="450000.00"
            className="h-12 text-base"
          />
        </Field>
        <Field label="Year built" name="year_built">
          <Input
            id="year_built"
            name="year_built"
            inputMode="numeric"
            defaultValue={home?.year_built ?? ""}
            placeholder="2005"
            className="h-12 text-base"
          />
        </Field>
        <Field label="Square feet" name="square_feet">
          <Input
            id="square_feet"
            name="square_feet"
            inputMode="numeric"
            defaultValue={home?.square_feet ?? ""}
            placeholder="3200"
            className="h-12 text-base"
          />
        </Field>
      </div>

      <Button type="submit" size="lg" className="mt-2 h-12">
        {submitLabel}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
    </div>
  );
}
