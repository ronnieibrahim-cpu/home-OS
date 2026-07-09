import { Loader2 } from "lucide-react";

// Shown instantly by Next.js while a route's data is being fetched from the
// server, so a tab/link tap never feels frozen while the network round-trip
// is in flight.
export function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
