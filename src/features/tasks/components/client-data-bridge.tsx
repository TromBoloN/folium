"use client";

import { useEffect } from "react";
import { type ClientData, setClientData } from "./client-data-store";

/** Hands server-loaded facts (courses, zone, week start) to the client-side task tools. Renders nothing. */
export function ClientDataBridge({ data }: { data: ClientData }) {
  useEffect(() => setClientData(data), [data]);
  return null;
}
