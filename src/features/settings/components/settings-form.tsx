"use client";

import { Check } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast/toaster";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { FormState } from "@/lib/action-result";
import { GradeScaleEditor } from "../../grades/components/grade-scale-editor";
import { updateSettings } from "../actions";
import { DEFAULT_THEME, DENSITIES, FONTS, MODES, MOTIONS, PRESETS, type Settings, type Theme } from "../schema";
import { PRESET_LABELS, themeAttributes } from "../theme";
import { PresetCard } from "./preset-card";

const DEFAULT_ACCENT_PICK = "#2f9e44";
/** How long to wait after the last change before saving (typing in the grade scale). */
const SAVE_DELAY_MS = 500;

type Props = { settings: Settings; timeZones: string[] };

/** Read the theme fields out of the form, falling back to defaults for anything odd. */
function themeFrom(data: FormData): Theme {
  const pick = <T extends string>(name: string, options: readonly T[], fallback: T) => {
    const v = data.get(name);
    return options.includes(v as T) ? (v as T) : fallback;
  };
  const accent = data.get("useAccent") === "on" ? String(data.get("accent") ?? "") : "";
  return {
    mode: pick("mode", MODES, DEFAULT_THEME.mode),
    preset: pick("preset", PRESETS, DEFAULT_THEME.preset),
    accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent.toLowerCase() : null,
    font: pick("font", FONTS, DEFAULT_THEME.font),
    density: pick("density", DENSITIES, DEFAULT_THEME.density),
    motion: pick("motion", MOTIONS, DEFAULT_THEME.motion),
  };
}

/** Re-theme the page right away, the same way the server renders <html>. */
function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const { style, ...attributes } = themeAttributes(theme);
  for (const [name, value] of Object.entries(attributes)) root.setAttribute(name, String(value));
  for (const name of ["--primary", "--ring", "--primary-foreground", "--hue"]) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(style as Record<string, string>)) root.style.setProperty(name, value);
}

/**
 * Settings apply as you change them: the theme updates on the spot, and the
 * whole form saves a moment later with an "Undo" toast. Without JavaScript it's
 * a normal form with a Save button.
 */
export function SettingsForm({ settings, timeZones }: Props) {
  const [state, action, pending] = useActionState(updateSettings, null);
  // Bumped to show the server's values again (after an undo).
  const [revision, setRevision] = useState(0);
  return (
    <SettingsFields
      // Remount after a rejected no-JS save (to show what was sent) or an undo; not after autosaves,
      // which would steal focus.
      key={`${state && !state.ok ? JSON.stringify(state) : "ok"}-${revision}`}
      settings={settings}
      timeZones={timeZones}
      state={state}
      action={action}
      pending={pending}
      onRestored={() => setRevision((r) => r + 1)}
    />
  );
}

function SettingsFields({
  settings,
  timeZones,
  state,
  action,
  pending,
  onRestored,
}: Props & { state: FormState; action: (formData: FormData) => void; pending: boolean; onRestored: () => void }) {
  const { theme, preferences } = settings;
  // After a rejected save, show what was submitted, not what's saved: React resets
  // uncontrolled fields to their defaults when the action finishes.
  const submitted = state && !state.ok ? state.values : undefined;
  const value = (name: string, saved: string) => submitted?.[name] ?? saved;
  const [useAccent, setUseAccent] = useState(submitted ? submitted.useAccent === "on" : theme.accent !== null);
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSaved = useRef<FormData | null>(null);
  const [status, setStatus] = useState<{ kind: "saving" | "saved" | "error"; text?: string } | null>(null);
  // JS is running: autosave replaces the Save button.
  const [live, setLive] = useState(false);
  useEffect(() => {
    setLive(true);
    if (form.current) lastSaved.current = new FormData(form.current);
    return () => clearTimeout(timer.current);
  }, []);

  const save = async (data: FormData, undoTo: FormData | null) => {
    setStatus({ kind: "saving" });
    const result = await updateSettings(null, data);
    if (!result?.ok) {
      setStatus({ kind: "error", text: result?.error ?? "Couldn't save." });
      return false;
    }
    setStatus({ kind: "saved" });
    lastSaved.current = data;
    if (undoTo) {
      toast({
        key: "settings",
        message: "Settings saved",
        action: {
          label: "Undo",
          onClick: async () => {
            applyTheme(themeFrom(undoTo));
            if (await save(undoTo, null)) startTransition(onRestored);
          },
        },
      });
    }
    return true;
  };

  const onChange = () => {
    const current = form.current;
    if (!current || !live) return;
    // "Saving…" from the first keystroke, so "Saved." always means the latest change is stored.
    setStatus({ kind: "saving" });
    // Next frame: a checkbox's own state (e.g. "use a custom accent") has re-rendered by then.
    requestAnimationFrame(() => {
      if (form.current) applyTheme(themeFrom(new FormData(form.current)));
    });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (form.current) save(new FormData(form.current), lastSaved.current);
    }, SAVE_DELAY_MS);
  };

  return (
    <form ref={form} action={action} onChange={onChange} className="flex flex-col gap-6">
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>How Folium looks on this account, on every device.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ChoiceGroup
              name="mode"
              legend="Mode"
              defaultValue={value("mode", theme.mode)}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
            <ChoiceGroup
              name="preset"
              legend="Colour"
              columns={5}
              defaultValue={value("preset", theme.preset)}
              options={PRESETS.map((p) => ({
                value: p,
                label: PRESET_LABELS[p],
                render: <PresetCard preset={p} label={PRESET_LABELS[p]} />,
              }))}
            />
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  id="useAccent"
                  name="useAccent"
                  type="checkbox"
                  checked={useAccent}
                  onChange={(e) => setUseAccent(e.target.checked)}
                  className="size-4 accent-primary"
                />
                <Label htmlFor="useAccent">Use a custom accent colour</Label>
              </div>
              <div className="flex items-center gap-3 pl-6">
                <input
                  id="accent"
                  name="accent"
                  type="color"
                  aria-label="Accent colour"
                  defaultValue={value("accent", theme.accent ?? DEFAULT_ACCENT_PICK)}
                  disabled={!useAccent}
                  className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-muted-foreground text-xs">Replaces the colour above for buttons and highlights.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="font">Font</Label>
                <NativeSelect id="font" name="font" defaultValue={value("font", theme.font)}>
                  <option value="geist">Geist</option>
                  <option value="inter">Inter</option>
                  <option value="system">System default</option>
                </NativeSelect>
              </div>
            </div>
            <ChoiceGroup
              name="density"
              legend="Density"
              columns={2}
              defaultValue={value("density", theme.density)}
              options={[
                { value: "comfortable", label: "Comfortable" },
                { value: "compact", label: "Compact" },
              ]}
            />
            <div className="flex flex-col gap-1">
              <ChoiceGroup
                name="motion"
                legend="Motion"
                defaultValue={value("motion", theme.motion)}
                options={[
                  { value: "full", label: "Full" },
                  { value: "subtle", label: "Subtle" },
                  { value: "off", label: "Off" },
                ]}
              />
              <p className="text-muted-foreground text-xs">
                Subtle keeps fades but nothing moves. If your device is set to reduce motion, animations stay off.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Calendar, time and language defaults.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="timeZone">Time zone</Label>
                <NativeSelect
                  id="timeZone"
                  name="timeZone"
                  defaultValue={value("timeZone", preferences.timeZone)}
                  aria-describedby="timeZone-hint"
                >
                  {timeZones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replaceAll("_", " ")}
                    </option>
                  ))}
                </NativeSelect>
                <p id="timeZone-hint" className="text-muted-foreground text-xs">
                  Decides what &ldquo;today&rdquo; is, and when date-only deadlines end.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="weekStart">Week starts on</Label>
                <NativeSelect id="weekStart" name="weekStart" defaultValue={value("weekStart", preferences.weekStart)}>
                  <option value="monday">Monday</option>
                  <option value="sunday">Sunday</option>
                  <option value="saturday">Saturday</option>
                </NativeSelect>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="language">Language</Label>
                <NativeSelect
                  id="language"
                  name="language"
                  defaultValue={value("language", preferences.language)}
                  aria-describedby="language-hint"
                >
                  <option value="en">English</option>
                  <option value="id">Bahasa Indonesia</option>
                </NativeSelect>
                <p id="language-hint" className="text-muted-foreground text-xs">
                  Saved for later. Folium is English-only for now.
                </p>
              </div>
            </div>
            <ChoiceGroup
              name="timeFormat"
              legend="Time format"
              columns={2}
              defaultValue={value("timeFormat", preferences.timeFormat)}
              options={[
                { value: "24h", label: "24-hour (14:30)" },
                { value: "12h", label: "12-hour (2:30 PM)" },
              ]}
            />
            <div className="grid gap-2">
              <Label htmlFor="attendanceTarget">Attendance target</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="attendanceTarget"
                  name="attendanceTarget"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  className="w-24"
                  defaultValue={value("attendanceTarget", String(preferences.attendanceTarget))}
                  aria-describedby="attendanceTarget-hint"
                />
                <span className="text-muted-foreground text-sm">% of classes</span>
              </div>
              <p id="attendanceTarget-hint" className="text-muted-foreground text-xs">
                Many campuses require about 75% to sit the final exam. Check yours; courses warn you below it.
              </p>
            </div>
            <GradeScaleEditor initial={submitted?.gradeScale ?? preferences.gradeScale} onEdit={onChange} />
          </CardContent>
        </Card>
      </div>

      <div className="flex min-h-9 items-center gap-3">
        {live ? null : (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
        )}
        <p aria-live="polite" className="flex items-center gap-1.5 text-sm">
          {live && status?.kind === "saving" ? <span className="text-muted-foreground">Saving…</span> : null}
          {live && status?.kind === "saved" ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Check aria-hidden className="size-4" /> Saved. Changes apply as you make them.
            </span>
          ) : null}
          {live && status?.kind === "error" ? <span className="text-destructive">Not saved: {status.text}</span> : null}
          {live && !status ? <span className="text-muted-foreground">Changes save as you make them.</span> : null}
          {!live && state?.ok ? <span className="text-muted-foreground">Saved.</span> : null}
          {!live && state && !state.ok ? <span className="text-destructive">{state.error}</span> : null}
        </p>
      </div>
    </form>
  );
}
