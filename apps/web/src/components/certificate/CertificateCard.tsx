'use client';

import { MunicipalityLink } from '@/components/uikit/municipality-link';
import styles from './CertificateCard.module.css';

export type CertificateType = 'verified_voter' | 'civic_patron';
export type CertificateStatus = 'pending' | 'minting' | 'minted' | 'failed';

export interface Certificate {
  id: string;
  type: CertificateType;
  status: CertificateStatus;
  voteId: string;
  voteTitle: string;
  municipality: string;
  imageUrl: string;
  mintAddress?: string | null;
  mintTxHash?: string | null;
  mintedAt?: string | null;
  createdAt?: string | null;
}

const TYPE_LABEL: Record<CertificateType, string> = {
  verified_voter: 'תושב מאומת · VERIFIED VOTER',
  civic_patron: 'גובה אזרחי · CIVIC PATRON',
};

const STATUS: Record<CertificateStatus, { label: string; tone: 'live' | 'wait' | 'fail' }> = {
  minted: { label: '✓ נחתם בשרשרת', tone: 'live' },
  minting: { label: '◴ נחתם כעת', tone: 'wait' },
  pending: { label: '□ ממתין לחתימה', tone: 'wait' },
  failed: { label: '✕ חתימה נכשלה', tone: 'fail' },
};

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('he-IL');
  } catch {
    return '—';
  }
}

/** Hard-edged press certificate — type-based seal artwork + the vote's record. */
export function CertificateCard({ cert }: { cert: Certificate }) {
  const status = STATUS[cert.status] ?? STATUS.pending;
  const seal = cert.mintTxHash || cert.mintAddress || null;

  return (
    <article className={styles.cert}>
      <div className={styles.plate}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.art} src={cert.imageUrl} alt="" loading="lazy" />
      </div>

      <div className={styles.body}>
        <span className={styles.type}>{TYPE_LABEL[cert.type]}</span>
        <h3 className={styles.title}>{cert.voteTitle}</h3>

        <dl className={styles.meta}>
          <div className={styles.metaRow}>
            <dt>רשות</dt>
            <dd><MunicipalityLink name={cert.municipality} /></dd>
          </div>
          <div className={styles.metaRow}>
            <dt>הונפק</dt>
            <dd>{fmtDate(cert.mintedAt || cert.createdAt)}</dd>
          </div>
          <div className={styles.metaRow}>
            <dt>חתימה</dt>
            <dd className={styles.seal}>{seal ? `${seal.slice(0, 10)}…` : '—'}</dd>
          </div>
        </dl>

        <span className={`${styles.status} ${styles[status.tone]}`}>{status.label}</span>
      </div>
    </article>
  );
}
