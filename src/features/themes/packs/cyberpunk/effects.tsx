"use client";

import type { ThemeEffectProps } from "../../manifest";
import "./effects.css";

type Vars = React.CSSProperties & Record<`--${string}`, string>;

/** Deterministic spread in [0, 1) so particles don't line up (and no Math.random). */
const spread = (i: number, seed: number) => (((i * 0.618034 + seed) % 1) + 1) % 1;

/**
 * Night City's moving layer: rain, falling data, flying-car lights, neon signs, a scan
 * beam, a rare glitch band and a HUD radar. Decoration only (aria-hidden, no text, no
 * pointer events), CSS keyframes on transform/opacity, everything that loops has `loop`.
 *
 * Budget (docs/themes.md section 11). Profiled at 4x CPU throttle: no dropped frames, but rain
 * was the largest single main-thread cost, so desktop has 16 drops, not the 24 allowed.
 *   immersive desktop: 16 rain + 6 data + 3 cars, 4 loops (neon, beam, glitch, radar)
 *   immersive phone:    8 rain, 2 loops (neon, beam)
 *   balanced:           no particles; neon and beam only
 *   subtle motion:      the neon signs, still
 */
export default function NightCity({ mobile, subtle, intensity }: ThemeEffectProps) {
  if (subtle) return <NeonSigns count={mobile ? 1 : 2} still />;
  const immersive = intensity === "immersive";
  const rain = immersive ? (mobile ? 8 : 16) : 0;
  const data = immersive && !mobile ? 6 : 0;
  const cars = immersive && !mobile ? 3 : 0;
  return (
    <>
      {rain > 0 ? (
        <div className="cyberpunk-rain">
          {Array.from({ length: rain }, (_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed set of decorative particles
              key={i}
              className="cyberpunk-drop loop"
              style={
                {
                  "--x": `${(spread(i, 0.13) * 100).toFixed(1)}%`,
                  "--d": `${(0.9 + spread(i, 0.41) * 0.8).toFixed(2)}s`,
                  "--delay": `${(-spread(i, 0.77) * 2).toFixed(2)}s`,
                  "--o": (0.25 + spread(i, 0.29) * 0.4).toFixed(2),
                } as Vars
              }
            />
          ))}
        </div>
      ) : null}
      {data > 0 ? (
        <div className="cyberpunk-data">
          {Array.from({ length: data }, (_, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a fixed set of decorative particles
              key={i}
              className="cyberpunk-stream loop"
              style={
                {
                  "--x": `${(4 + spread(i, 0.5) * 92).toFixed(1)}%`,
                  "--d": `${(9 + spread(i, 0.2) * 9).toFixed(1)}s`,
                  "--delay": `${(-spread(i, 0.9) * 18).toFixed(1)}s`,
                } as Vars
              }
            />
          ))}
        </div>
      ) : null}
      {Array.from({ length: cars }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed set of decorative particles
          key={i}
          className="cyberpunk-car loop"
          data-dir={i % 2 ? "left" : "right"}
          style={
            {
              "--y": `${(34 + i * 7).toFixed(0)}svh`,
              "--d": `${16 + i * 5}s`,
              "--delay": `${-i * 6}s`,
            } as Vars
          }
        />
      ))}
      <NeonSigns count={mobile ? 1 : immersive ? 3 : 2} />
      <span className="cyberpunk-beam loop" />
      {immersive && !mobile ? (
        <>
          <span className="cyberpunk-glitch loop" />
          <Radar />
        </>
      ) : null}
    </>
  );
}

/** Neon signs on the skyline: a wide faint "glow" stroke under a crisp tube that buzzes (opacity only). */
function NeonSigns({ count, still = false }: { count: number; still?: boolean }) {
  const signs = [ChevronSign, RingSign, TowerSign].slice(0, count);
  return (
    <>
      {signs.map((Sign, i) => (
        <span key={Sign.name} className="cyberpunk-neon" data-sign={i}>
          <Sign className="cyberpunk-neon-glow" />
          <Sign className={still ? "cyberpunk-neon-tube" : "cyberpunk-neon-tube cyberpunk-buzz loop"} />
        </span>
      ))}
    </>
  );
}

function ChevronSign({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 120 40" className={className} fill="none" strokeWidth="3" strokeLinejoin="miter">
      <path d="M8 6l14 14-14 14M30 6l14 14-14 14M52 6l14 14-14 14" />
      <path d="M78 8h34M78 20h22M78 32h30" strokeWidth="2" />
    </svg>
  );
}

function RingSign({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 80 80" className={className} fill="none" strokeWidth="3">
      <circle cx="40" cy="40" r="32" />
      <path d="M26 26h28M40 26v30M28 42h24M30 56l10-8 10 8" strokeWidth="2.5" />
    </svg>
  );
}

function TowerSign({ className }: { className: string }) {
  return (
    <svg aria-hidden viewBox="0 0 30 120" className={className} fill="none" strokeWidth="2.5">
      <rect x="3" y="3" width="24" height="114" />
      <path d="M9 14h12M9 22h12M15 14v16M9 40h12l-6 10zM9 64h12M15 58v18M9 76l6-6 6 6M9 92h12v12H9z" />
    </svg>
  );
}

function Radar() {
  return (
    <span className="cyberpunk-radar">
      <svg aria-hidden viewBox="0 0 120 120" className="cyberpunk-radar-svg" fill="none" strokeWidth="1">
        <circle cx="60" cy="60" r="56" />
        <circle cx="60" cy="60" r="38" strokeDasharray="3 5" />
        <circle cx="60" cy="60" r="18" />
        <path d="M60 0v120M0 60h120" strokeDasharray="2 6" />
        <path d="M60 2l4 8h-8z" className="cyberpunk-radar-mark" />
      </svg>
      <span className="cyberpunk-sweep loop" />
    </span>
  );
}
