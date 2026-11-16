import { ThemeEffects } from "@/features/themes/effects";

/**
 * The fixed background behind every page. The theme pack draws on it:
 * `::before` is the scene (glows, gradients, images), `::after` the texture
 * (grain, scanlines, vignette), and an optional effects component goes inside.
 */
export function Ambient() {
  return (
    <div aria-hidden data-slot="ambient" className="ambient">
      <ThemeEffects />
    </div>
  );
}
