import { useId } from "react";

/**
 * GA monogram — "A emerging from inside the G"
 *
 * Layering technique:
 *   1. Draw A (orange) fully — behind everything
 *   2. Fill G's inner hollow with 3 circles that exactly replicate
 *      the background gradient stack (gradientUnits="userSpaceOnUse"
 *      guarantees pixel-perfect color match at every position)
 *   3. Draw G white stroke on top — its arc/edge body covers A where
 *      the legs cross the G boundary (~y 46→67 in the opening)
 *   4. Small orange dot at G's crossbar inner tip — hints that the
 *      A originates inside the G
 *
 * Result: A is invisible inside the G and appears to push out from
 *         the G's lower edge, descending below the letterform.
 *
 * Geometry (100 × 100 viewBox):
 *   G — center (44,46) · radius 30 · stroke 13 · 90° gap
 *       top-gap (65,25) · bot-gap (65,67) · crossbar → (44,46)
 *   A — apex (65,46) · left-base (53,85) · right-base (77,85)
 *       crossbar (58,68)→(72,68)   [just below G's lower arc]
 */

interface GizLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function GizLogo({ size = 36, className = "", style }: GizLogoProps) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, "");
  const gradId   = `gl-grad-${uid}`;
  const glowId   = `gl-glow-${uid}`;
  const shadowId = `gl-shad-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      role="img"
      aria-label="BrasUX Shopping"
    >
      <defs>
        {/*
          userSpaceOnUse: coordinates are in the 100×100 viewport.
          Every shape (rect or circle) samples the same gradient values
          at the same viewport positions → perfect background match.
        */}
        <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0%"   stopColor="#22c55e" />
          <stop offset="40%"  stopColor="#16a34a" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>

        {/* Top-left glass sheen */}
        <radialGradient id={glowId} gradientUnits="userSpaceOnUse" cx="28" cy="22" r="65">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.26)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
        </radialGradient>

        {/* Bottom-right depth shadow */}
        <radialGradient id={shadowId} gradientUnits="userSpaceOnUse" cx="82" cy="82" r="52">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.22)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)"    />
        </radialGradient>
      </defs>

      {/* ── 1. Background ── */}
      <rect width="100" height="100" rx="22" fill={`url(#${gradId})`}   />
      <rect width="100" height="100" rx="22" fill={`url(#${glowId})`}   />
      <rect width="100" height="100" rx="22" fill={`url(#${shadowId})`} />

      {/* ── 2. A (drawn first — behind G and blocker) ──
             Orange, thinner stroke.
             Upper portion will be hidden by layers 3 & 4. */}
      <path
        d="M 53 85 L 65 46 L 77 85"
        stroke="#fb923c"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 58 68 L 72 68"
        stroke="#fb923c"
        strokeWidth="8"
        strokeLinecap="round"
      />

      {/* ── 3. Blocker — three circles that pixel-perfectly replicate ──
             the background stack at the G's inner hollow (r ≈ 24,
             slightly bigger than G's inner radius 23.5 for full coverage).
             This erases every visible trace of the A inside the G. */}
      <circle cx="44" cy="46" r="24" fill={`url(#${gradId})`}   />
      <circle cx="44" cy="46" r="24" fill={`url(#${glowId})`}   />
      <circle cx="44" cy="46" r="24" fill={`url(#${shadowId})`} />

      {/* ── 4. G (white · bold · primary) ──
             270° CCW arc + lower-right straight edge + crossbar.
             Its thick white stroke naturally covers A's legs where they
             cross the opening boundary (x≈65, y=46→67). */}
      <path
        d="M 65 25 A 30 30 0 1 0 65 67 L 65 46 L 44 46"
        stroke="white"
        strokeWidth="13"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* ── 5. Orange seed dot ──
             Sits at the G's crossbar inner tip (65,46) — the exact point
             where the A begins inside the G. Rendered last so it shows
             on top of the white G, hinting at the hidden A within. */}
      <circle cx="65" cy="46" r="5" fill="#fb923c" />
    </svg>
  );
}
