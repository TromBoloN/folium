import { CalendarRange, MapPin, Pencil, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Button } from "@/components/ui/button";
import { deleteSlot } from "../actions";
import { describeSlot, formatDateRange, formatTimeRange } from "../format";
import { sortSlots, weekdayLabel } from "../logic";
import type { TimetableSlot } from "../types";
import { OverlapWarning } from "./overlap-warning";

type Props = {
  slots: TimetableSlot[];
  conflicts: Map<string, TimetableSlot[]>;
  courseRoom: string | null;
  timeFormat: "24h" | "12h";
};

export function SlotList({ slots, conflicts, courseRoom, timeFormat }: Props) {
  return (
    <ul className="flex flex-col tile divide-y divide-border-soft overflow-hidden">
      {sortSlots(slots).map((slot) => {
        const location = slot.location ?? courseRoom;
        const range = formatDateRange(slot.startsOn, slot.endsOn);
        const overlaps = (conflicts.get(slot.id) ?? []).map((o) => describeSlot(o, timeFormat));
        return (
          <li key={slot.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="font-medium">
                {weekdayLabel(slot.weekday)}{" "}
                <span className="font-normal text-muted-foreground tabular-nums">
                  {formatTimeRange(slot, timeFormat)}
                </span>
              </p>
              {location ? (
                <p className="flex items-center gap-1 text-muted-foreground text-sm">
                  <MapPin aria-hidden className="size-3.5" />
                  {location}
                </p>
              ) : null}
              {slot.online ? (
                <p className="flex items-center gap-1 text-muted-foreground text-sm">
                  <Video aria-hidden className="size-3.5" />
                  Online
                  {slot.meetingUrl ? (
                    <>
                      {" · "}
                      <a
                        href={slot.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground underline underline-offset-4"
                      >
                        Open link
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
              {range ? (
                <p className="flex items-center gap-1 text-muted-foreground text-sm">
                  <CalendarRange aria-hidden className="size-3.5" />
                  {range}
                </p>
              ) : null}
              <OverlapWarning withNames={overlaps} />
            </div>
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="icon">
                <Link
                  href={`/courses/${slot.courseId}/slots/${slot.id}/edit`}
                  aria-label={`Edit ${weekdayLabel(slot.weekday)} class`}
                >
                  <Pencil aria-hidden />
                </Link>
              </Button>
              <ActionForm action={deleteSlot} fields={{ id: slot.id }}>
                <SubmitButton variant="ghost" size="icon" aria-label={`Delete ${weekdayLabel(slot.weekday)} class`}>
                  <Trash2 aria-hidden />
                </SubmitButton>
              </ActionForm>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
