import { useState } from "react";
import { getProductImageUrl } from "../../services/gizApi";

interface Props {
  logoUrl?: string;
  name: string;
  className?: string;
}

export default function StoreLogo({ logoUrl, name, className = "h-full w-full object-cover" }: Props) {
  const [error, setError] = useState(false);

  if (!logoUrl || error) return <>{name.charAt(0).toUpperCase()}</>;

  return (
    <img
      src={getProductImageUrl(logoUrl)}
      alt=""
      className={className}
      onError={() => setError(true)}
    />
  );
}
