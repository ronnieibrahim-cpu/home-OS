"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Armchair, Plus, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/assets", label: "Assets", icon: Armchair },
  { href: "/assets/new", label: "Add", icon: Plus },
  { href: "/expenses", label: "Money", icon: Wallet },
];

// Thumb-reachable navigation for iPhone; safe-area padding for the notch bar.
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href) && href !== "/assets/new";
          const isAdd = href === "/assets/new";
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-xs",
                active ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              <Icon
                className={cn(
                  "size-6",
                  isAdd && "rounded-full bg-primary p-1 text-primary-foreground"
                )}
              />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
