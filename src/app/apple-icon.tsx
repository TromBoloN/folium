import { ImageResponse } from "next/og";
import { IconArt } from "@/lib/pwa/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iOS. */
export default function AppleIcon() {
  return new ImageResponse(<IconArt size={180} />, size);
}
