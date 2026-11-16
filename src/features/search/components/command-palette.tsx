"use client";

import {
  AlarmClock,
  ArrowRightLeft,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Circle,
  GraduationCap,
  ListChecks,
  type LucideIcon,
  Plus,
  Search,
  Settings,
  Sun,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast/toaster";
import { deleteTransaction, quickAddMoney } from "@/features/finance/actions/transactions";
import { QuickMoneyPreview, useQuickMoney } from "@/features/finance/components/quick-money";
import { removeBreak, runScheduleCommand, undoChange } from "@/features/schedule/actions";
import { useScheduleCommand } from "@/features/schedule/components/command-preview";
import { quickAddTask, removeTask } from "@/features/tasks/actions";
import { ParsePreview } from "@/features/tasks/components/parse-preview";
import { QUICK_ADD_HINT } from "@/features/tasks/parse";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/core";
import { cn } from "@/lib/utils";
import { type SearchResults, searchEverything } from "../actions";

export type PaletteMode = "add" | "search" | "money";

type Item = {
  key: string;
  group: string;
  label: string;
  detail?: string;
  icon: LucideIcon;
  color?: string;
  run: () => void;
};

const COMMANDS: { label: MessageKey; href: string; icon: LucideIcon; group: MessageKey }[] = [
  { label: "Today", href: "/", icon: Sun, group: "Go to" },
  { label: "Money", href: "/money", icon: Wallet, group: "Go to" },
  { label: "All transactions", href: "/money/transactions", icon: Wallet, group: "Go to" },
  { label: "Money accounts", href: "/money/accounts", icon: Wallet, group: "Go to" },
  { label: "Money categories", href: "/money/categories", icon: Wallet, group: "Go to" },
  { label: "School: Tasks", href: "/tasks", icon: ListChecks, group: "Go to" },
  { label: "Overdue tasks", href: "/tasks?due=overdue", icon: AlarmClock, group: "Go to" },
  { label: "School: Courses", href: "/courses", icon: BookOpen, group: "Go to" },
  { label: "This week by day", href: "/courses?view=day", icon: CalendarDays, group: "Go to" },
  { label: "Week timetable", href: "/courses?view=week", icon: CalendarDays, group: "Go to" },
  { label: "School: Grades", href: "/grades", icon: GraduationCap, group: "Go to" },
  { label: "Settings", href: "/settings", icon: Settings, group: "Go to" },
  { label: "New task with details", href: "/tasks/new", icon: Plus, group: "Create" },
  { label: "New course", href: "/courses/new", icon: BookOpen, group: "Create" },
  { label: "New transaction with details", href: "/money/new", icon: Wallet, group: "Create" },
  { label: "Add a class time", href: "/courses/timetable/new", icon: CalendarPlus, group: "Create" },
];

/**
 * Ctrl/⌘K palette. "Add" mode turns one line into a task (with date, time,
 * #course and !priority understood); "search" mode finds tasks, courses and
 * pages. A combobox: arrows move, Enter runs, Escape closes.
 */
export function CommandPalette({ initialMode, onClose }: { initialMode: PaletteMode; onClose: () => void }) {
  const { t: tr, tl } = useI18n();
  const [mode, setMode] = useState(initialMode);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [adding, startAdding] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const toast = useToast();
  const listId = useId();

  const close = () => dialog.current?.close();
  const scheduleCommand = useScheduleCommand(mode === "money" ? "" : text);
  // Money: the Money mode (N on /money), or a line starting with "$" in any mode.
  const moneyText = mode === "money" ? text : text.trimStart().startsWith("$") ? text.trimStart().slice(1) : null;
  const money = useQuickMoney(moneyText ?? "", moneyText !== null);

  // A transaction in one line: saved only when the amount and account are resolved, with Undo.
  const addMoney = () => {
    if (!moneyText?.trim()) return;
    if (!money.canSave) {
      setError(money.draft?.errors[0] ? tl(money.draft.errors[0]) : tr("Add an amount and an account."));
      return;
    }
    setError(null);
    startAdding(async () => {
      const result = await quickAddMoney(moneyText);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { id, message } = result.data;
      toast({
        message,
        duration: 8000,
        action: { label: tr("Undo"), onClick: async () => void (await deleteTransaction(id)) },
      });
      router.refresh();
      close();
    });
  };

  // A schedule change ("cancel physics tomorrow"): applied at once, with Undo.
  const apply = () => {
    setError(null);
    startAdding(async () => {
      const result = await runScheduleCommand(text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const { undo, message } = result.data;
      toast({
        message,
        action: {
          label: tr("Undo"),
          onClick: async () =>
            void (undo.kind === "break"
              ? await removeBreak(undo.id)
              : await undoChange({ key: undo.key, previous: undo.previous })),
        },
      });
      router.refresh();
      close();
    });
  };

  // Search as you type (debounced); stale responses are ignored.
  useEffect(() => {
    if (mode !== "search" || text.trim().length < 2) {
      setResults(null);
      return;
    }
    let current = true;
    const timer = setTimeout(async () => {
      const result = await searchEverything(text);
      if (current && result.ok) setResults(result.data);
    }, 180);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [text, mode]);

  const add = () => {
    if (!text.trim()) return;
    setError(null);
    startAdding(async () => {
      const form = new FormData();
      form.set("title", text);
      const result = await quickAddTask(null, form);
      if (!result?.ok) {
        setError(result?.error ? tl(result.error) : tr("Couldn't add the task."));
        return;
      }
      const id = result.result?.id;
      toast({
        message: tr("Added: {title}", { title: result.result?.title ?? text }),
        action: id ? { label: tr("Undo"), onClick: async () => void (await removeTask(id)) } : undefined,
      });
      close();
    });
  };

  // Rebuilt each render: a handful of items, and `add` must see the latest text.
  const items = ((): Item[] => {
    const go = (href: string) => () => {
      router.push(href);
      dialog.current?.close();
    };
    const q = text.trim().toLowerCase();
    const list: Item[] = [];
    if (moneyText !== null) {
      if (moneyText.trim())
        list.push({
          key: "money",
          group: tr("Money"),
          label: money.canSave ? tr("Add transaction") : tr("Add an amount and an account"),
          icon: Wallet,
          run: addMoney,
        });
      return list;
    }
    const applyItem: Item | null = scheduleCommand
      ? { key: "apply", group: tr("Schedule"), label: scheduleCommand.summary, icon: ArrowRightLeft, run: apply }
      : null;
    if (mode === "add") {
      if (applyItem) list.push(applyItem);
      if (q)
        list.push({
          key: "add",
          group: tr("Add"),
          label: applyItem ? tr("Add “{title}” as a task", { title: text.trim() }) : tr("Add task"),
          icon: Plus,
          run: add,
        });
      return list;
    }
    if (applyItem) list.push(applyItem);
    for (const t of results?.tasks ?? []) {
      list.push({
        key: `task-${t.id}`,
        group: tr("Tasks"),
        label: t.title,
        detail: t.course ? (t.course.code ?? t.course.name) : undefined,
        color: t.course?.color,
        icon: t.done ? CheckCircle2 : Circle,
        run: go(`/tasks/${t.id}`),
      });
    }
    for (const c of results?.courses ?? []) {
      list.push({
        key: `course-${c.id}`,
        group: tr("Courses"),
        label: c.name,
        detail: [c.code, c.archived ? tr("archived") : null].filter(Boolean).join(" · ") || undefined,
        color: c.color,
        icon: BookOpen,
        run: go(`/courses/${c.id}`),
      });
    }
    for (const cmd of COMMANDS) {
      // Matched in the user's language (and in English, so habits from before still work).
      const label = tr(cmd.label);
      if (!q || label.toLowerCase().includes(q) || cmd.label.toLowerCase().includes(q)) {
        list.push({ key: cmd.href, group: tr(cmd.group), label, icon: cmd.icon, run: go(cmd.href) });
      }
    }
    if (q)
      list.push({
        key: "add",
        group: tr("Add"),
        label: tr("Add “{title}” as a task", { title: text.trim() }),
        icon: Plus,
        run: add,
      });
    return list;
  })();

  const safeActive = Math.min(active, Math.max(0, items.length - 1));
  const optionId = (i: number) => `${listId}-${i}`;

  return (
    <dialog
      ref={(el) => {
        dialog.current = el;
        if (el && !el.open) el.showModal();
      }}
      onClose={onClose}
      aria-label={
        mode === "add" ? tr("Add a task") : mode === "money" ? tr("Add a transaction") : tr("Search and commands")
      }
      className="toast-in mx-auto mt-[12vh] mb-auto w-[min(40rem,calc(100vw-2rem))] overflow-hidden rounded-tile border border-border-soft bg-popover p-0 text-popover-foreground shadow-raised backdrop:bg-foreground/35"
      onClick={(e) => {
        if (e.target === e.currentTarget) close(); // a click on the backdrop
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActive((i) => (items.length ? (Math.min(i, items.length - 1) + 1) % items.length : 0));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setActive((i) => (items.length ? (Math.min(i, items.length - 1) - 1 + items.length) % items.length : 0));
        } else if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          items[safeActive]?.run();
        }
      }}
    >
      <div className="flex items-center gap-3 border-border-soft border-b px-4">
        {mode === "money" ? (
          <Wallet aria-hidden className="size-5 shrink-0 text-primary" />
        ) : mode === "add" ? (
          <Plus aria-hidden className="size-5 shrink-0 text-primary" />
        ) : (
          <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        )}
        <input
          autoFocus
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls={listId}
          aria-activedescendant={items.length ? optionId(safeActive) : undefined}
          aria-autocomplete="list"
          aria-label={
            mode === "money"
              ? tr("New transaction")
              : mode === "add"
                ? tr("New task")
                : tr("Search tasks, courses and pages")
          }
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          placeholder={
            mode === "money" ? "gofood 32k #food @gopay" : mode === "add" ? tr("Add a task…") : tr("Search or jump to…")
          }
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          autoComplete="off"
          enterKeyHint={mode === "search" ? "go" : "done"}
        />
        <button
          type="button"
          onClick={() => {
            setMode(mode === "search" ? "add" : "search");
            setActive(0);
          }}
          className="shrink-0 rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
        >
          {mode === "search" ? tr("Add a task") : tr("Search instead")}
        </button>
      </div>

      {moneyText !== null ? (
        <div className="flex min-h-12 flex-col gap-1 px-4 py-3">
          {money.draft ? (
            <QuickMoneyPreview draft={money.draft} />
          ) : (
            <p className="text-muted-foreground text-xs">
              {money.loading
                ? tr("Loading your accounts…")
                : tr(
                    "One line: amount, then #category, @account, “to dana” for a transfer, + for income, “kemarin” for yesterday.",
                  )}
            </p>
          )}
          {error ? (
            <p role="alert" className="text-destructive text-xs">
              {tl(error)}
            </p>
          ) : null}
        </div>
      ) : mode === "add" ? (
        <div className="flex min-h-12 flex-col gap-1 px-4 py-3">
          {scheduleCommand ? (
            <p className="text-muted-foreground text-xs">
              {tr("Schedule change: press Enter to apply (you can undo it).")}
            </p>
          ) : text ? (
            <ParsePreview text={text} />
          ) : (
            <p className="text-muted-foreground text-xs">
              {tr("{hint}, change a class: “cancel physics tomorrow”, or start with $ for money: “$ gofood 32k”", {
                hint: tr(QUICK_ADD_HINT),
              })}
            </p>
          )}
          {error ? (
            <p role="alert" className="text-destructive text-xs">
              {tl(error)}
            </p>
          ) : null}
        </div>
      ) : null}

      {mode === "search" && error ? (
        <p role="alert" className="px-4 pt-3 text-destructive text-xs">
          {tl(error)}
        </p>
      ) : null}

      <div
        id={listId}
        role="listbox"
        aria-label={tr("Results")}
        className="max-h-[50vh] overflow-y-auto p-2 empty:hidden"
      >
        {items.map((item, i) => {
          const showGroup = i === 0 || items[i - 1].group !== item.group;
          return (
            <div key={item.key} role="presentation">
              {showGroup && mode === "search" ? (
                <div aria-hidden className="px-2 pt-2 pb-1 font-medium text-muted-foreground text-xs">
                  {item.group}
                </div>
              ) : null}
              <div
                id={optionId(i)}
                role="option"
                tabIndex={-1}
                aria-selected={i === safeActive}
                onPointerMove={() => setActive(i)}
                onClick={item.run}
                onKeyDown={() => {}}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm",
                  i === safeActive && "bg-accent text-accent-foreground",
                )}
              >
                <item.icon
                  aria-hidden
                  className={cn("size-4 shrink-0", item.color ? "text-(--tint)" : "text-muted-foreground")}
                  style={item.color ? ({ "--tint": item.color } as React.CSSProperties) : undefined}
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.detail ? <span className="shrink-0 text-muted-foreground text-xs">{item.detail}</span> : null}
                {(item.key === "add" || item.key === "apply") && adding ? (
                  <span className="text-muted-foreground text-xs">
                    {item.key === "apply" ? tr("Applying…") : tr("Adding…")}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 border-border-soft border-t px-4 py-2 text-muted-foreground text-xs">
        <span>
          <kbd className="font-sans">↑↓</kbd> {tr("move")}
        </span>
        <span>
          <kbd className="font-sans">Enter</kbd> {mode === "add" ? tr("add") : tr("open")}
        </span>
        <span>
          <kbd className="font-sans">Esc</kbd> {tr("close")}
        </span>
        <span className="ml-auto inline-flex items-center gap-1">
          <CalendarClock aria-hidden className="size-3" /> {tr("N to add · Ctrl/⌘K to search")}
        </span>
      </p>
    </dialog>
  );
}
