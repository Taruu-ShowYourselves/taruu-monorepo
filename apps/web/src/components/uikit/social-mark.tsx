/**
 * The site's social glyph set, in one place.
 *
 * These were drawn inline inside the intro's brand dock, which was fine while
 * the dock was the only thing that had them. It is not: a tile's share control
 * is the same kind of mark and has to sit in the same family, and two copies of
 * a hand-drawn `x` diverge the first time one of them is nudged.
 *
 * The marks carry no styling of their own. Every glyph is stroked by the
 * caller's `svg` rule and the solid paths take `fillClassName`, so the intro's
 * circular chips and the desk's tile button each keep their own weight without
 * the geometry being redrawn.
 */

export type SocialGlyph = 'instagram' | 'facebook' | 'x' | 'share';

interface SocialMarkProps {
  glyph: SocialGlyph;
  /**
   * Applied to the paths meant to read as solid. The stroke/fill convention
   * lives in the consuming stylesheet, so a filled glyph needs a hook there
   * rather than a hard-coded `fill` here.
   */
  fillClassName?: string;
  className?: string;
}

export function SocialMark({ glyph, fillClassName, className }: SocialMarkProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {glyph === 'instagram' && (
        <>
          <rect x="3.1" y="3.1" width="17.8" height="17.8" rx="5.1" />
          <circle cx="12" cy="12" r="4.1" />
          <circle cx="17.45" cy="6.65" r="1" className={fillClassName} />
        </>
      )}
      {glyph === 'facebook' && (
        <path
          className={fillClassName}
          d="M13.6 21v-8h2.75l.42-3.15H13.6V7.83c0-.91.26-1.53 1.6-1.53h1.7V3.48c-.3-.04-1.3-.13-2.48-.13-2.46 0-4.15 1.5-4.15 4.27v2.23H7.5V13h2.77v8h3.33Z"
        />
      )}
      {glyph === 'x' && (
        <path
          className={fillClassName}
          d="M4.2 3.5h4.55l4.2 5.56 4.86-5.56h1.98l-5.94 6.8 6.2 8.2H15.5l-4.65-6.15-5.38 6.15H3.5l6.45-7.38L4.2 3.5Zm3.58 1.4H6.95l9.55 12.2h.84L7.78 4.9Z"
        />
      )}
      {/* Three nodes and the two links between them - the same stroked
          construction as the Instagram mark, so it reads as one of the set
          rather than as an icon borrowed from a toolbar. */}
      {glyph === 'share' && (
        <>
          <circle cx="17.6" cy="5.6" r="2.6" />
          <circle cx="6.4" cy="12" r="2.6" />
          <circle cx="17.6" cy="18.4" r="2.6" />
          <path d="M8.75 10.75 15.25 6.85" />
          <path d="M8.75 13.25l6.5 3.9" />
        </>
      )}
    </svg>
  );
}
