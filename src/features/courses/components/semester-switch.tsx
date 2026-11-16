"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { useT } from "@/lib/i18n/client";

/**
 * "2026 Ganjil ▾": which semester the course cards show. A GET form, so it works
 * without JavaScript (with a Show button); with it, choosing navigates at once.
 */
export function SemesterSwitch({ semesters, current }: { semesters: string[]; current: string }) {
  const t = useT();
  const router = useRouter();
  return (
    <form action="/courses" method="get" className="flex items-center gap-2">
      <input type="hidden" name="view" value="cards" />
      <label htmlFor="semester" className="sr-only">
        {t("Semester")}
      </label>
      <NativeSelect
        id="semester"
        name="semester"
        defaultValue={current}
        className="w-auto min-w-44 font-medium"
        onChange={(e) => router.push(`/courses?view=cards&semester=${encodeURIComponent(e.target.value)}`)}
      >
        {semesters.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
        <option value="all">{t("All semesters")}</option>
      </NativeSelect>
      <noscript>
        <button type="submit" className="h-10 rounded-lg border border-border px-3 text-sm">
          {t("Show")}
        </button>
      </noscript>
    </form>
  );
}
