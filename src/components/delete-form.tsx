"use client";

import { SubmitButton } from "@/components/submit-button";

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
      <SubmitButton variant="destructive" size="sm">
        {label}
      </SubmitButton>
    </form>
  );
}
