import { useId } from "react";

/**
 * Petit biberon dessiné en SVG. `level` (0 → 1) remplit le lait :
 * plein quand le bébé vient de manger, vide quand il a faim.
 */
export function BabyBottle({
  level,
  size = 18,
  className,
  milk = "#ffffff",
}: {
  level: number;
  size?: number;
  className?: string;
  milk?: string;
}) {
  const id = useId().replace(/:/g, "");
  const clamped = Math.max(0, Math.min(1, level));
  // Corps du biberon : de y = 9 à y = 23 (14 unités).
  const top = 23 - 14 * clamped;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <clipPath id={`bottle-${id}`}>
          <rect x="6.5" y="9" width="11" height="14" rx="3" />
        </clipPath>
      </defs>
      {/* tétine */}
      <path d="M10 5.2c0-1.5.9-3.2 2-3.2s2 1.7 2 3.2V6h-4v-.8Z" fill="currentColor" opacity="0.85" />
      {/* bague */}
      <rect x="8" y="6" width="8" height="3" rx="1.2" fill="currentColor" />
      {/* lait */}
      <g clipPath={`url(#bottle-${id})`}>
        <rect x="6.5" y={top} width="11" height={23 - top} fill={milk} />
      </g>
      {/* contour */}
      <rect x="6.5" y="9" width="11" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
      {/* graduations */}
      <path d="M8.6 13h2.2M8.6 16h2.2M8.6 19h2.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
