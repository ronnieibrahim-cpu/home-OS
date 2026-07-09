"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Shows a spinner and disables the button the instant a form is submitted,
// so a tap always feels immediate even while the server round-trip is
// still in flight. Must be rendered inside the <form> it belongs to.
export function SubmitButton({
  children,
  className,
  variant,
  size = "lg",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} variant={variant} size={size} className={className}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}
