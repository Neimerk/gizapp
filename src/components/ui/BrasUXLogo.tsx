interface BrasUXLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function BrasUXLogo({ size = 36, className = "", style }: BrasUXLogoProps) {
  return (
    <img
      src="/logo-brasux.webp"
      alt="BrasUX Shopping"
      width={size}
      height={size}
      className={className}
      style={{ display: "block", ...style }}
      draggable={false}
    />
  );
}
