import { useId } from "react";

interface BrasUXLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function BrasUXLogo({ size = 36, className = "", style }: BrasUXLogoProps) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, "");
  const bgId    = `bx-bg-${uid}`;
  const glowId  = `bx-glow-${uid}`;
  const bladeId = `bx-blade-${uid}`;

  // Blade shape: curved leaf/fin starting at center, sweeping outward
  const blade = "M 50 50 C 56 28, 78 18, 84 32 C 90 46, 68 54, 50 50 Z";

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
        <radialGradient id={bgId} gradientUnits="userSpaceOnUse" cx="32" cy="28" r="72">
          <stop offset="0%"   stopColor="#0d2218" />
          <stop offset="100%" stopColor="#050d07" />
        </radialGradient>

        <radialGradient id={glowId} gradientUnits="userSpaceOnUse" cx="50" cy="50" r="42">
          <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.55" />
          <stop offset="60%"  stopColor="#22c55e" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0"    />
        </radialGradient>

        {/* Blade gradient: bright tip → rich mid → dark root */}
        <linearGradient id={bladeId} gradientUnits="userSpaceOnUse" x1="84" y1="18" x2="50" y2="54">
          <stop offset="0%"   stopColor="#86efac" />
          <stop offset="42%"  stopColor="#22c55e" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>
      </defs>

      {/* ── Background ── */}
      <rect width="100" height="100" rx="22" fill={`url(#${bgId})`}   />

      {/* ── Ambient glow ── */}
      <circle cx="50" cy="50" r="44" fill={`url(#${glowId})`} />

      {/* ── Three blades, each 120° apart ── */}
      <path d={blade} fill={`url(#${bladeId})`} />
      <g transform="rotate(120 50 50)">
        <path d={blade} fill={`url(#${bladeId})`} />
      </g>
      <g transform="rotate(240 50 50)">
        <path d={blade} fill={`url(#${bladeId})`} />
      </g>

      {/* ── Outer orbs ── */}
      <circle cx="70" cy="11" r="4.5"  fill="#22c55e" opacity="0.92" />
      <circle cx="86" cy="62" r="3.5"  fill="#22c55e" opacity="0.85" />
      <circle cx="19" cy="74" r="3.5"  fill="#22c55e" opacity="0.85" />
      <circle cx="26" cy="17" r="2.5"  fill="#22c55e" opacity="0.60" />

      {/* ── Central sphere ── */}
      <circle cx="50" cy="50" r="9"   fill="#22c55e" />
      <circle cx="46" cy="46" r="3.5" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}
