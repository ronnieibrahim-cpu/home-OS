import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function PageHeader({
  title,
  backHref,
  action,
}: {
  title: string;
  backHref?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-4 flex items-center gap-2">
      {backHref && (
        <Link
          href={backHref}
          className="-ml-2 flex size-10 items-center justify-center text-muted-foreground"
          aria-label="Back"
        >
          <ChevronLeft className="size-6" />
        </Link>
      )}
      <h1 className="flex-1 truncate text-xl font-semibold tracking-tight">{title}</h1>
      {action}
    </header>
  );
}
