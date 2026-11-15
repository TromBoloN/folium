import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
    >
      <ChevronLeft aria-hidden className="size-4" />
      {children}
    </Link>
  );
}
