"use client";

import { Check } from "lucide-react";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast/toaster";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { FormState } from "@/lib/action-result";
import { useI18n } from "@/lib/i18n/client";
import { GradeScaleEditor } from "../../grades/components/grade-scale-editor";
import { getManifest } from "../../themes/registry";
import { updateSettings } from "../actions";
import {
  DEFAULT_THEME,
  DENSITIES,
  EFFECTS,
  FONTS,
  MODES,
  MOTIONS,
  PRESETS,
  type Settings,
  type Theme,
} from "../schema";
import { PRESET_LABELS, themeAttributes } from "../theme";
import { ClassTypesEditor } from "./class-types-editor";
import { PresetCard } from "./preset-card";

const DEFAULT_ACCENT_PICK = "#2f9e44";
/** How long to wait after the last change before saving (typing in the grade scale). */
const SAVE_DELAY_MS = 500;

type Props = { settings: Settings; timeZones: string[] };

/** Read the theme fields out of the form, falling back to defaults for anything odd. */
function themeFrom(data: FormData, pack: Theme["pack"]): Theme {
  const pick = <T extends string>(name: string, options: readonly T[], fallback: T) => {
    const v = data.get(name);
    return options.includes(v as T) ? (v as T) : fallback;
  };
  const accent = data.get("useAccent") === "on" ? String(data.get("accent") ?? "") : "";
  return {
    pack,
    mode: pick("mode", MODES, DEFAULT_THEME.mode),
    preset: pick("preset", PRESETS, DEFAULT_THEME.preset),
    accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent.toLowerCase() : null,
    font: pick("font", FONTS, DEFAULT_THEME.font),
    density: pick("density", DENSITIES, DEFAULT_THEME.density),
    motion: pick("motion", MOTIONS, DEFAULT_THEME.motion),
    effects: pick("effects", EFFECTS, DEFAULT_THEME.effects),
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
  const pack = getManifest(theme.pack);
  const { t, tl } = useI18n();
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
      setStatus({ kind: "error", text: result?.error ? tl(result.error) : t("Couldn't save.") });
      return false;
    }
    setStatus({ kind: "saved" });
    lastSaved.current = data;
    if (undoTo) {
      toast({
        key: "settings",
        message: t("Settings saved"),
        action: {
          label: t("Undo"),
          onClick: async () => {
            applyTheme(themeFrom(undoTo, theme.pack));
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
      if (form.current) applyTheme(themeFrom(new FormData(form.current), theme.pack));
    });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (form.current) save(new FormData(form.current), lastSaved.current);
    }, SAVE_DELAY_MS);
  };

  return (
    <form ref={form} action={action} onChange={onChange} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <Card>
          <CardHeader>
            <CardTitle>{t("Appearance")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ChoiceGroup
              name="mode"
              legend={t("Mode")}
              defaultValue={value("mode", theme.mode)}
              options={[
                { value: "system", label: t("System") },
                { value: "light", label: t("Light") },
                { value: "dark", label: t("Dark") },
              ]}
            />
            {pack.scheme !== "both" ? (
              <p className="-mt-4 text-muted-foreground text-xs">
                {pack.scheme === "dark"
                  ? t("The {name} theme is always dark.", { name: t(pack.label) })
                  : t("The {name} theme is always light.", { name: t(pack.label) })}
              </p>
            ) : null}
            {pack.palette === "custom" ? (
              <>
                {/* The pack brings its own colours; keep the saved choices for when you switch back. */}
                <input type="hidden" name="preset" value={value("preset", theme.preset)} />
                {theme.accent ? <input type="hidden" name="useAccent" value="on" /> : null}
                <input type="hidden" name="accent" value={value("accent", theme.accent ?? "")} />
                <p className="text-muted-foreground text-sm">
                  {t("The {name} theme brings its own colours.", { name: t(pack.label) })}
                </p>
              </>
            ) : (
              <>
                <ChoiceGroup
                  name="preset"
                  legend={t("Colour")}
                  columns={5}
                  defaultValue={value("preset", theme.preset)}
                  options={PRESETS.map((p) => ({
                    value: p,
                    label: t(PRESET_LABELS[p]),
                    render: <PresetCard preset={p} label={t(PRESET_LABELS[p])} />,
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
                    <Label htmlFor="useAccent">{t("Use a custom accent colour")}</Label>
                  </div>
                  <div className="flex items-center gap-3 pl-6">
                    <input
                      id="accent"
                      name="accent"
                      type="color"
                      aria-label={t("Accent colour")}
                      defaultValue={value("accent", theme.accent ?? DEFAULT_ACCENT_PICK)}
                      disabled={!useAccent}
                      className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </div>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="font">{t("Font")}</Label>
                <NativeSelect id="font" name="font" defaultValue={value("font", theme.font)}>
                  <option value="geist">Geist</option>
                  <option value="inter">Inter</option>
                  <option value="system">{t("System default")}</option>
                </NativeSelect>
              </div>
            </div>
            <ChoiceGroup
              name="density"
              legend={t("Density")}
              columns={2}
              defaultValue={value("density", theme.density)}
              options={[
                { value: "comfortable", label: t("Comfortable") },
                { value: "compact", label: t("Compact") },
              ]}
            />
            <div className="flex flex-col gap-1">
              <ChoiceGroup
                name="motion"
                legend={t("Motion")}
                defaultValue={value("motion", theme.motion)}
                options={[
                  { value: "full", label: t("Full") },
                  { value: "subtle", label: t("Subtle") },
                  { value: "off", label: t("Off") },
                ]}
              />
              <p className="text-muted-foreground text-xs">
                {t(
                  "Subtle keeps fades but nothing moves. If your device is set to reduce motion, animations stay off.",
                )}
              </p>
            </div>
            {pack.effects ? (
              <div className="flex flex-col gap-1">
                <ChoiceGroup
                  name="effects"
                  legend={t("Theme effects")}
                  defaultValue={value("effects", theme.effects)}
                  options={[
                    { value: "immersive", label: t("Immersive") },
                    { value: "balanced", label: t("Balanced") },
                    { value: "minimal", label: t("Minimal") },
                  ]}
                />
                <p className="text-muted-foreground text-xs">
                  {t(
                    "How much of the {name} theme's background scene you see. Feedback such as a completed task still animates; Motion decides that.",
                    { name: t(pack.label) },
                  )}
                </p>
              </div>
            ) : (
              <input type="hidden" name="effects" value={theme.effects} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("Preferences")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="timeZone">{t("Time zone")}</Label>
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
                  {t("Decides what “today” is, and when date-only deadlines end.")}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="weekStart">{t("Week starts on")}</Label>
                <NativeSelect id="weekStart" name="weekStart" defaultValue={value("weekStart", preferences.weekStart)}>
                  <option value="monday">{t("Monday")}</option>
                  <option value="sunday">{t("Sunday")}</option>
                  <option value="saturday">{t("Saturday")}</option>
                </NativeSelect>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="language">{t("Language")}</Label>
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
                  {t("The whole app, dates included. Your quick-add phrases stay in English.")}
                </p>
              </div>
            </div>
            <ChoiceGroup
              name="timeFormat"
              legend={t("Time format")}
              columns={2}
              defaultValue={value("timeFormat", preferences.timeFormat)}
              options={[
                { value: "24h", label: t("24-hour (14:30)") },
                { value: "12h", label: t("12-hour (2:30 PM)") },
              ]}
            />
            <div className="grid gap-2">
              <Label htmlFor="attendanceTarget">{t("Attendance target")}</Label>
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
                <span className="text-muted-foreground text-sm">{t("% of classes")}</span>
              </div>
              <p id="attendanceTarget-hint" className="text-muted-foreground text-xs">
                {t("Many campuses require about 75% to sit the final exam. Check yours; courses warn you below it.")}
              </p>
            </div>
            <ClassTypesEditor initial={submitted?.classTypes ?? preferences.classTypes} onEdit={onChange} />
            <GradeScaleEditor initial={submitted?.gradeScale ?? preferences.gradeScale} onEdit={onChange} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium text-sm">{t("Money emails")}</legend>
              {(
                [
                  ["billReminderEmails", "Remind me before a bill is due", preferences.billReminderEmails],
                  [
                    "weeklySummaryEmail",
                    "A Monday summary: spent, left, and what's due",
                    preferences.weeklySummaryEmail,
                  ],
                ] as const
              ).map(([name, label, saved]) => (
                <label key={name} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={name}
                    defaultChecked={submitted ? submitted[name] === "on" : saved}
                    className="size-4 accent-primary"
                  />
                  {t(label)}
                </label>
              ))}
            </fieldset>
          </CardContent>
        </Card>
      </div>

      <div className="flex min-h-9 items-center gap-3">
        {live ? null : (
          <Button type="submit" disabled={pending}>
            {pending ? t("Saving…") : t("Save settings")}
          </Button>
        )}
        <p aria-live="polite" className="flex items-center gap-1.5 text-sm">
          {live && status?.kind === "saving" ? <span className="text-muted-foreground">{t("Saving…")}</span> : null}
          {live && status?.kind === "saved" ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Check aria-hidden className="size-4" /> {t("Saved. Changes apply as you make them.")}
            </span>
          ) : null}
          {live && status?.kind === "error" ? (
            <span className="text-destructive">{t("Not saved: {reason}", { reason: status.text ?? "" })}</span>
          ) : null}
          {live && !status ? (
            <span className="text-muted-foreground">{t("Changes save as you make them.")}</span>
          ) : null}
          {!live && state?.ok ? <span className="text-muted-foreground">{t("Saved.")}</span> : null}
          {!live && state && !state.ok ? <span className="text-destructive">{tl(state.error)}</span> : null}
        </p>
      </div>
    </form>
  );
}
