"use client";

import { Download, Smartphone } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/client";
import { rich } from "@/lib/i18n/rich";
import { clearInstallPrompt, getInstallPrompt, onInstallPromptChange } from "./pwa-runtime";

/** "Install Folium": the browser's prompt where there is one, instructions on iPhone/iPad, nothing once installed. */
export function InstallCard() {
  const t = useT();
  const prompt = useSyncExternalStore(onInstallPromptChange, getInstallPrompt, () => null);
  const [env, setEnv] = useState<{ standalone: boolean; ios: boolean } | null>(null);
  useEffect(() => {
    setEnv({
      standalone: window.matchMedia("(display-mode: standalone)").matches,
      ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
    });
  }, []);
  if (!env || env.standalone || (!prompt && !env.ios)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone aria-hidden className="size-4" /> {t("Install Folium")}
        </CardTitle>
        <CardDescription>{t("Open it from your home screen or dock like an app, in its own window.")}</CardDescription>
      </CardHeader>
      <CardContent>
        {prompt ? (
          <Button
            size="sm"
            onClick={async () => {
              await prompt.prompt();
              await prompt.userChoice;
              clearInstallPrompt();
            }}
          >
            <Download aria-hidden />
            {t("Install")}
          </Button>
        ) : (
          <p className="text-sm">
            {rich(t("In Safari, tap {share}, then {add}."), {
              share: <span className="font-medium">{t("Share")}</span>,
              add: <span className="font-medium">{t("Add to Home Screen")}</span>,
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
