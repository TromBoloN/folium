import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { TrL } from "@/lib/i18n/client";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-1 inline-flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
    >
      <ChevronLeft aria-hidden className="size-4" />
      {/* Plain-text labels ("Schedule") are translated here so callers needn't. */}
      {typeof children === "string" ? <TrL text={children} /> : children}
    </Link>
  );
}
