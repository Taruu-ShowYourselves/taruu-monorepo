import { formatScore, scoreBand, trackGeometry } from '@/lib/civic/score';
import styles from './Government.module.css';

interface ScoreMeterProps {
  label: string;
  /** null = not measured; the track prints hatched and the value an em-dash. */
  score: number | null;
  /** What the score was computed over, e.g. "measured over 12 matched votes". */
  evidence: string;
  /** One sentence on how it is derived. */
  method: string;
  scaleMin: string;
  scaleMax: string;
}

/**
 * One signed civic score on the shared −100..+100 track.
 *
 * Zero is drawn rather than implied, the bar runs from zero out to the score
 * so its length is the deviation, and the evidence line sits under it: a
 * number about a named person that does not say what it was measured over is
 * not a measurement.
 */
export function ScoreMeter({
  label,
  score,
  evidence,
  method,
  scaleMin,
  scaleMax,
}: ScoreMeterProps) {
  const { from, span } = trackGeometry(score);
  const unmeasured = score === null;

  return (
    <div className={styles.meter} data-band={scoreBand(score)}>
      <div className={styles.meterHead}>
        <span className={styles.meterLabel}>{label}</span>
        <b className={styles.meterValue}>{formatScore(score)}</b>
      </div>

      <div className={`${styles.track}${unmeasured ? ` ${styles.trackEmpty}` : ''}`}>
        <span
          className={styles.trackFill}
          style={{ ['--from' as string]: `${from}%`, ['--span' as string]: `${span}%` }}
        />
        <span aria-hidden className={styles.trackZero} />
      </div>

      <div className={styles.scaleRow}>
        <span>{scaleMin}</span>
        <span>0</span>
        <span>{scaleMax}</span>
      </div>

      <span className={styles.meterNote}>{evidence}</span>
      <p className={styles.meterMethod}>{method}</p>
    </div>
  );
}
