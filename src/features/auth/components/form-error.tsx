import { TrL } from "@/lib/i18n/client";

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      <TrL text={message} />
    </p>
  );
}
