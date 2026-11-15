"use client";

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveDashboardLayout } from "../actions";
import { moveItem, type ResolvedLayout } from "../layout";

export type WidgetMeta = { id: string; title: string; description: string };

type Props = { widgets: WidgetMeta[]; layout: ResolvedLayout; defaultOrder: string[] };

/**
 * Show, hide and reorder widgets. Drag with a mouse, touch (press and hold) or
 * the keyboard (Space to pick up, arrows to move, Space to drop); the up/down
 * buttons do the same in one tap. Nothing is saved until "Save layout".
 */
export function DashboardEditor({ widgets, layout, defaultOrder }: Props) {
  const [order, setOrder] = useState(layout.order);
  const [hidden, setHidden] = useState<string[]>(layout.hidden);
  const [state, action, pending] = useActionState(saveDashboardLayout, null);
  // The controls only work once hydrated; data-ready tells tests (and CSS) when that is.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const title = (id: string | number) => byId.get(String(id))?.title ?? String(id);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${title(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${title(active.id)} is now at position ${order.indexOf(String(over.id)) + 1} of ${order.length}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${title(active.id)} dropped at position ${order.indexOf(String(over.id)) + 1}.`
        : `${title(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${title(active.id)} cancelled.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOrder((current) => arrayMove(current, current.indexOf(String(active.id)), current.indexOf(String(over.id))));
  };

  const toggle = (id: string, show: boolean) =>
    setHidden((current) => (show ? current.filter((h) => h !== id) : [...current, id]));

  return (
    <form action={action} data-ready={ready || undefined} className="flex flex-col gap-4">
      {order.map((id) => (
        <input key={`o-${id}`} type="hidden" name="order" value={id} />
      ))}
      {hidden.map((id) => (
        <input key={`h-${id}`} type="hidden" name="hidden" value={id} />
      ))}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "To reorder, press Space or Enter to pick up, use the arrow keys to move, then press Space or Enter to drop, or Escape to cancel.",
          },
        }}
      >
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {order.map((id, index) => (
              <SortableRow
                key={id}
                widget={byId.get(id) ?? { id, title: id, description: "" }}
                visible={!hidden.includes(id)}
                first={index === 0}
                last={index === order.length - 1}
                onToggle={(show) => toggle(id, show)}
                onMove={(direction) => setOrder((current) => moveItem(current, id, direction))}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {state && !state.ok ? (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save layout"}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">Cancel</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={() => {
            setOrder(defaultOrder);
            setHidden([]);
          }}
        >
          Reset to default
        </Button>
      </div>
    </form>
  );
}

type RowProps = {
  widget: WidgetMeta;
  visible: boolean;
  first: boolean;
  last: boolean;
  onToggle: (show: boolean) => void;
  onMove: (direction: "up" | "down") => void;
};

function SortableRow({ widget, visible, first, last, onToggle, onMove }: RowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card p-2 pr-3",
        isDragging && "relative z-10 shadow-lg ring-2 ring-ring",
        !visible && "bg-muted/60",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Reorder ${widget.title}`}
        className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-4 shrink-0 accent-primary"
          aria-label={`Show ${widget.title}`}
        />
        <span className="flex min-w-0 flex-col">
          <span className={cn("font-medium", !visible && "text-muted-foreground")}>{widget.title}</span>
          <span className="truncate text-muted-foreground text-xs">{widget.description}</span>
        </span>
      </label>
      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onMove("up")}
          disabled={first}
          aria-label={`Move ${widget.title} up`}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onMove("down")}
          disabled={last}
          aria-label={`Move ${widget.title} down`}
        >
          <ArrowDown aria-hidden />
        </Button>
      </div>
    </li>
  );
}
