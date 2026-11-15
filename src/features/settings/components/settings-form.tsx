"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { FormState } from "@/lib/action-result";
import { updateSettings } from "../actions";
import { PRESETS, type Settings } from "../schema";
import { PRESET_LABELS } from "../theme";

const DEFAULT_ACCENT_PICK = "#2f9e44";

type Props = { settings: Settings; timeZones: string[] };

export function SettingsForm({ settings, timeZones }: Props) {
  const [state, action, pending] = useActionState(updateSettings, null);
  // Remount after each result so every field (selects included) takes its new default.
  return (
    <SettingsFields
      key={JSON.stringify(state)}
      settings={settings}
      timeZones={timeZones}
      state={state}
      action={action}
      pending={pending}
    />
  );
}

function SettingsFields({
  settings,
  timeZones,
  state,
  action,
  pending,
}: Props & { state: FormState; action: (formData: FormData) => void; pending: boolean }) {
  const { theme, preferences } = settings;
  // After a rejected save, show what was submitted, not what's saved: React resets
  // uncontrolled fields to their defaults when the action finishes.
  const submitted = state && !state.ok ? state.values : undefined;
  const value = (name: string, saved: string) => submitted?.[name] ?? saved;
  const [useAccent, setUseAccent] = useState(submitted ? submitted.useAccent === "on" : theme.accent !== null);

  return (
    <form action={action} className="flex flex-col gap-6">
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
            options={PRESETS.map((p) => ({ value: p, label: PRESET_LABELS[p], swatch: p }))}
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
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        <p aria-live="polite" className="text-sm">
          {state?.ok ? <span className="text-muted-foreground">Saved.</span> : null}
          {state && !state.ok ? <span className="text-destructive">{state.error}</span> : null}
        </p>
      </div>
    </form>
  );
}
