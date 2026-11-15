import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/pwa/brand";

/** Makes Folium installable (home screen / dock) and opens it like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Folium",
    short_name: "Folium",
    description: "Your classes, deadlines and tasks in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BRAND.paper,
    theme_color: BRAND.paper,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Add a task", url: "/tasks/new" },
      { name: "Timetable", url: "/courses/timetable" },
    ],
  };
}
