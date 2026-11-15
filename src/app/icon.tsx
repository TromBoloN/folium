import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/pwa/brand";

/** App icons at the sizes the web app manifest needs: /icon/192 and /icon/512. */
export function generateImageMetadata() {
  return [
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id) || 192;
  return new ImageResponse(<IconArt size={size} />, { width: size, height: size });
}
