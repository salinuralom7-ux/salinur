import { useId } from 'react';
import type { Listing } from '../types';
import { isDark } from '../data/colors';

/**
 * A generated illustration of the handset in the colour that was selected.
 *
 * We deliberately do not publish stock press photos: every unit on the shelf is
 * a different physical phone with its own marks, and a glossy manufacturer
 * render would misrepresent what arrives in the box. Photographs of the actual
 * unit are taken on request — see `PhotoRequestDialog`.
 */

type Silhouette = 'notch' | 'island' | 'punch' | 'home-button';

function silhouetteFor(listing: Listing): Silhouette {
  if (listing.brand !== 'Apple') return 'punch';

  const name = listing.model;
  if (name.includes('SE') || name === 'iPhone 7' || name === 'iPhone 7 Plus') return 'home-button';
  if (name === 'iPhone 8' || name === 'iPhone 8 Plus') return 'home-button';

  // Dynamic Island arrived with the 14 Pro and spread to the whole line from 15.
  if (listing.year >= 2023) return 'island';
  if (name.includes('14 Pro')) return 'island';
  return 'notch';
}

export default function PhoneRender({
  listing,
  size = 'md',
}: {
  listing: Listing;
  size?: 'sm' | 'md' | 'lg';
}) {
  const gradientId = useId();
  const silhouette = silhouetteFor(listing);
  const { hex, hex2 } = listing.color;
  const dark = isDark(hex);
  const edge = dark ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.2)';
  const screen = dark ? '#0b0f16' : '#131a24';

  return (
    <svg
      className={`phone phone-${size}`}
      viewBox="0 0 120 200"
      role="img"
      aria-label={`${listing.brand} ${listing.model} in ${listing.color.name}`}
    >
      <defs>
        <linearGradient id={`${gradientId}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={hex} />
          <stop offset="55%" stopColor={hex2 ?? hex} />
          <stop offset="100%" stopColor={dark ? '#000' : hex} stopOpacity={dark ? 0.55 : 1} />
        </linearGradient>
        <linearGradient id={`${gradientId}-glass`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#5b8fd6" stopOpacity="0.55" />
          <stop offset="45%" stopColor={screen} stopOpacity="0.95" />
          <stop offset="100%" stopColor={screen} />
        </linearGradient>
      </defs>

      {/* Body */}
      <rect
        x="16"
        y="6"
        width="88"
        height="188"
        rx={silhouette === 'home-button' ? 12 : 16}
        fill={`url(#${gradientId}-body)`}
        stroke={edge}
        strokeWidth="1.5"
      />

      {/* Screen */}
      <rect
        x={silhouette === 'home-button' ? 21 : 20}
        y={silhouette === 'home-button' ? 22 : 10}
        width={silhouette === 'home-button' ? 78 : 80}
        height={silhouette === 'home-button' ? 148 : 180}
        rx={silhouette === 'home-button' ? 3 : 12}
        fill={`url(#${gradientId}-glass)`}
      />

      {silhouette === 'notch' && (
        <path d="M44 10 h32 a4 4 0 0 1 4 4 v4 a5 5 0 0 1 -5 5 h-30 a5 5 0 0 1 -5 -5 v-4 a4 4 0 0 1 4 -4 z" fill="#0a0d12" />
      )}
      {silhouette === 'island' && <rect x="47" y="16" width="26" height="9" rx="4.5" fill="#0a0d12" />}
      {silhouette === 'punch' && <circle cx="60" cy="21" r="4" fill="#0a0d12" />}
      {silhouette === 'home-button' && (
        <>
          <circle cx="60" cy="181" r="8" fill="none" stroke={edge} strokeWidth="1.5" />
          <rect x="52" y="14" width="16" height="3" rx="1.5" fill={edge} />
        </>
      )}

      {/* Camera island */}
      <rect
        x="22"
        y="12"
        width={listing.brand === 'Apple' ? 30 : 26}
        height={listing.brand === 'Apple' ? 30 : 24}
        rx="8"
        fill={dark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.08)'}
        opacity="0"
      />

      {/* Side buttons */}
      <rect x="14.5" y="46" width="2" height="14" rx="1" fill={edge} />
      <rect x="14.5" y="66" width="2" height="22" rx="1" fill={edge} />
      <rect x="103.5" y="52" width="2" height="26" rx="1" fill={edge} />
    </svg>
  );
}
