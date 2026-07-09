import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Room } from "@/lib/types";

export function RoomForm({
  action,
  room,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>;
  room?: Room;
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          name="name"
          required
          defaultValue={room?.name ?? ""}
          placeholder="Kitchen"
          className="h-12 text-base"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="floor">Floor</Label>
        <Input
          id="floor"
          name="floor"
          defaultValue={room?.floor ?? ""}
          placeholder="1st"
          className="h-12 text-base"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={room?.description ?? ""}
          className="text-base"
        />
      </div>
      <Button type="submit" size="lg" className="mt-2 h-12">
        {submitLabel}
      </Button>
    </form>
  );
}
