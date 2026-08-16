/**
 * The instruments the civic field is drawn with.
 *
 * The thesis backdrop used to print eight figures in one voice - same weight,
 * same shape, and the same three words repeated eight times whenever a count
 * had not landed yet. Eight identical readings are not a field of measurement,
 * they are wallpaper.
 *
 * So every figure is given its own instrument: a bar meter, a dot swarm, tally
 * strokes, a ring gauge, a trace, a hatch block. The mark is proportional - it
 * says roughly how big - and the number beside it stays exact. Nothing here is
 * decorative noise: every stroke count is derived from the figure it sits
 * under, which is also why it renders identically on the server and the client
 * (no clocks, no randomness).
 */

import type { CSSProperties } from 'react';

export type LedgerMarkKind =
  | 'bars'
  | 'dots'
  | 'tally'
  | 'ring'
  | 'trace'
  | 'hatch'
  | 'plate';

/** The decade above a figure: 267 -> 1000, 46 -> 100, 7013 -> 10000. */
function decade(value: number): number {
  const magnitude = Math.max(1, Math.abs(value));
  return 10 ** Math.ceil(Math.log10(magnitude + 1));
}

/**
 * Where a figure sits inside its own decade, 0-1.
 *
 * Deliberately not normalised across the eight metrics: 46 municipalities and
 * 67,783 posts share no scale, and a bar chart that put them on one would be
 * a lie told for the sake of a tidy row.
 */
function fill(value: number): number {
  return Math.min(1, Math.max(0.06, value / decade(value)));
}

/** Digits of a figure, which is what gives each trace its own silhouette. */
function digits(value: number): number[] {
  const out = Math.trunc(Math.abs(value))
    .toString()
    .split('')
    .map((digit) => Number(digit));
  return out.length ? out : [0];
}

const VIEW_W = 96;
const VIEW_H = 30;

interface MarkProps {
  kind: LedgerMarkKind;
  /** The figure the mark measures; null while it is still being counted. */
  value: number | null;
  className?: string;
  /** Mono caption printed under the mark by the caller, not here. */
  style?: CSSProperties;
}

/**
 * One instrument. A null figure draws the same instrument with nothing in it -
 * an empty scale reads as "not counted yet" without spending a sentence on it,
 * and it differs from metric to metric because the instruments do.
 */
export function LedgerMark({ kind, value, className, style }: MarkProps) {
  const ratio = value === null ? 0 : fill(value);
  const parts = value === null ? [] : digits(value);

  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="presentation"
      aria-hidden
      focusable="false"
      data-mark={kind}
      data-empty={value === null ? '' : undefined}
    >
      {kind === 'bars' && <Bars ratio={ratio} parts={parts} />}
      {kind === 'dots' && <Dots ratio={ratio} />}
      {kind === 'tally' && <Tally ratio={ratio} />}
      {kind === 'ring' && <Ring ratio={ratio} />}
      {kind === 'trace' && <Trace parts={parts} />}
      {kind === 'hatch' && <Hatch ratio={ratio} />}
      {kind === 'plate' && <Plate filled={value !== null} />}
    </svg>
  );
}

/** Bar meter: seven columns, each raised by one digit of the figure. */
function Bars({ ratio, parts }: { ratio: number; parts: number[] }) {
  const columns = 7;
  const width = 8;
  const gap = (VIEW_W - columns * width) / (columns - 1);
  return (
    <g>
      {Array.from({ length: columns }, (_, index) => {
        const digit = parts.length ? parts[index % parts.length] : 0;
        const height = parts.length
          ? Math.max(3, (0.28 + (digit / 9) * 0.72) * VIEW_H * ratio + 3)
          : 3;
        return (
          <rect
            key={index}
            x={index * (width + gap)}
            y={VIEW_H - height}
            width={width}
            height={height}
            fill="currentColor"
            opacity={parts.length ? 0.85 : 0.28}
          />
        );
      })}
    </g>
  );
}

/** Dot swarm: an 18-cell field, filled in proportion. */
function Dots({ ratio }: { ratio: number }) {
  const cols = 9;
  const rows = 2;
  const filled = Math.round(ratio * cols * rows);
  return (
    <g>
      {Array.from({ length: cols * rows }, (_, index) => {
        const isFilled = index < filled;
        return (
          <circle
            key={index}
            cx={5 + (index % cols) * ((VIEW_W - 10) / (cols - 1))
            }
            cy={9 + Math.floor(index / cols) * 13}
            r={isFilled ? 3.4 : 2.2}
            fill={isFilled ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={1}
            opacity={isFilled ? 0.9 : 0.3}
          />
        );
      })}
    </g>
  );
}

/** Tally strokes, gated in fives - the way a count is kept by hand. */
function Tally({ ratio }: { ratio: number }) {
  const strokes = Math.max(0, Math.round(ratio * 20));
  const groups = Math.ceil(strokes / 5) || 1;
  const groupW = VIEW_W / Math.max(groups, 4);
  return (
    <g stroke="currentColor" strokeWidth={2} strokeLinecap="square">
      {Array.from({ length: strokes }, (_, index) => {
        const group = Math.floor(index / 5);
        const within = index % 5;
        const x = group * groupW + 4 + within * 5;
        if (within === 4) {
          // The fifth stroke is the one laid across the other four.
          return (
            <line
              key={index}
              x1={group * groupW + 1}
              y1={VIEW_H - 4}
              x2={group * groupW + 22}
              y2={5}
              opacity={0.9}
            />
          );
        }
        return <line key={index} x1={x} y1={4} x2={x} y2={VIEW_H - 4} opacity={0.85} />;
      })}
      {strokes === 0 && (
        <line x1={1} y1={VIEW_H / 2} x2={VIEW_W - 1} y2={VIEW_H / 2} opacity={0.22} />
      )}
    </g>
  );
}

/** Ring gauge: one sweep, read like a dial. */
function Ring({ ratio }: { ratio: number }) {
  const r = 12;
  const circumference = 2 * Math.PI * r;
  return (
    <g transform={`translate(${VIEW_H / 2 + 2} ${VIEW_H / 2}) rotate(-90)`}>
      <circle r={r} fill="none" stroke="currentColor" strokeWidth={2} opacity={0.22} />
      <circle
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="butt"
        strokeDasharray={`${circumference * ratio} ${circumference}`}
        opacity={0.9}
      />
    </g>
  );
}

/** A trace whose silhouette is the figure's own digits. */
function Trace({ parts }: { parts: number[] }) {
  if (!parts.length) {
    return (
      <line
        x1={1}
        y1={VIEW_H / 2}
        x2={VIEW_W - 1}
        y2={VIEW_H / 2}
        stroke="currentColor"
        strokeWidth={1.5}
        opacity={0.22}
      />
    );
  }
  const points = parts
    .map((digit, index) => {
      const x = parts.length === 1 ? VIEW_W / 2 : (index / (parts.length - 1)) * VIEW_W;
      const y = VIEW_H - 3 - (digit / 9) * (VIEW_H - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <g>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        opacity={0.9}
      />
      {parts.map((digit, index) => {
        const x = parts.length === 1 ? VIEW_W / 2 : (index / (parts.length - 1)) * VIEW_W;
        const y = VIEW_H - 3 - (digit / 9) * (VIEW_H - 8);
        return <circle key={index} cx={x} cy={y} r={1.8} fill="currentColor" opacity={0.7} />;
      })}
    </g>
  );
}

/** Hatch block: density stands in for volume where the count runs large. */
function Hatch({ ratio }: { ratio: number }) {
  const lines = Math.max(1, Math.round(ratio * 16));
  const step = VIEW_W / 16;
  return (
    <g stroke="currentColor" strokeWidth={1.6}>
      {Array.from({ length: lines }, (_, index) => (
        <line
          key={index}
          x1={index * step}
          y1={VIEW_H - 2}
          x2={index * step + 10}
          y2={2}
          opacity={0.72}
        />
      ))}
      <line x1={0} y1={VIEW_H - 1} x2={VIEW_W} y2={VIEW_H - 1} opacity={0.3} />
    </g>
  );
}

/** A named finding rather than a count: a plate the name is set on. */
function Plate({ filled }: { filled: boolean }) {
  return (
    <g>
      <rect
        x={0.5}
        y={0.5}
        width={VIEW_W - 1}
        height={VIEW_H - 1}
        fill="none"
        stroke="currentColor"
        strokeWidth={filled ? 2 : 1}
        opacity={filled ? 0.55 : 0.22}
      />
      <rect
        x={0}
        y={0}
        width={filled ? VIEW_W * 0.34 : 6}
        height={4}
        fill="currentColor"
        opacity={filled ? 0.8 : 0.3}
      />
    </g>
  );
}
