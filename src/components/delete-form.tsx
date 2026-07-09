"use client";

import { Button } from "@/components/ui/button";

// Wraps a destructive server action behind a native confirm() dialog.
export function DeleteForm({
  action,
  label,
  confirmMessage,
}: {
  action: () => Promise<void>;
  label: string;
  confirmMessage: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <Button type="submit" variant="destructive" size="sm">
        {label}
      </Button>
    </form>
  );
}
