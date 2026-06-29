'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { NewsButton, Receipt } from '@/components/press';
import { useMerchCartStore } from '@/stores/merchCartStore';
import { formatCurrency } from '@sync/shared';
import type { MerchOrder, MerchOrderStatus } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import styles from './ThankYouView.module.css';

interface ThankYouViewProps {
  locale: Locale;
}

const STATUS_LABEL: Record<MerchOrderStatus, string> = {
  pending: 'ממתין לתשלום',
  paid: 'שולם · בהכנה',
  fulfilling: 'בהכנה אצל שותף ההדפסה',
  shipped: 'נשלח',
  cancelled: 'בוטל',
  failed: 'התשלום נכשל',
};

export function ThankYouView({ locale }: ThankYouViewProps) {
  const searchParams = useSearchParams();
  const clear = useMerchCartStore((s) => s.clear);

  const orderId = searchParams.get('order');
  const isMock = searchParams.get('mock') === '1';

  const [order, setOrder] = useState<MerchOrder | null>(null);
  const [loading, setLoading] = useState(!isMock && Boolean(orderId));

  // Order is placed; empty the cart so a refresh/back doesn't re-show it.
  useEffect(() => {
    clear();
  }, [clear]);

  // Fetch the persisted order (skipped for the dev mock flow, which never
  // writes one).
  useEffect(() => {
    if (isMock || !orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/merch/orders/${orderId}`);
        if (res.ok) {
          const data = (await res.json()) as { order: MerchOrder };
          if (!cancelled) setOrder(data.order);
        }
      } catch {
        // Fall through to the id-only confirmation below.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, isMock]);

  const rows = order
    ? [
        { label: 'מספר הזמנה', value: shortId(order.id) },
        { label: 'סטטוס', value: STATUS_LABEL[order.status], strong: true },
        { label: 'פריטים', value: String(itemCount(order)) },
        { label: 'משלוח', value: order.shippingILS === 0 ? 'חינם' : formatCurrency(order.shippingILS) },
        { label: 'סך הכול', value: formatCurrency(order.totalILS), strong: true },
      ]
    : [
        { label: 'מספר הזמנה', value: orderId ? shortId(orderId) : '—' },
        {
          label: 'סטטוס',
          value: isMock ? 'הדגמה · לא חויב' : 'שולם · בהכנה',
          strong: true,
        },
      ];

  return (
    <div className={styles.thanks}>
      <div className={styles.inner}>
        <span className={styles.kicker}>
          <span aria-hidden className={styles.kickerTick} />
          אישור הזמנה · CONFIRMED
        </span>

        <h1 className={styles.headline}>
          ההזמנה <span className={styles.red}>התקבלה.</span>
        </h1>

        <p className={styles.standfirst}>
          {isMock
            ? 'זוהי הדגמה — לא בוצע חיוב. בסביבת הייצור ההזמנה נשמרת, התשלום מאומת מול הספק, וחשבונית מס נשלחת למייל.'
            : 'תודה. ההזמנה נקלטה והתשלום אושר. שותף ההדפסה-לפי-הזמנה מתחיל בהכנה, וחשבונית מס כבר בדרך למייל שלכם.'}
        </p>

        {order && order.items.length > 0 ? (
          <ul className={styles.lines}>
            {order.items.map((it) => (
              <li key={`${it.slug}-${it.variantId}`} className={styles.line}>
                <span className={styles.lineName}>
                  {it.name}
                  <span className={styles.lineVariant}>{it.variantLabel}</span>
                </span>
                <span className={styles.lineQty}>×{it.quantity}</span>
                <span className={styles.linePrice}>
                  {formatCurrency(it.unitPriceILS * it.quantity)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <Receipt
          className={styles.receipt}
          kicker="פרטי הזמנה · ORDER"
          rows={rows}
          footer={
            loading
              ? 'טוען פרטי הזמנה…'
              : 'שילוח תוך 7–14 ימי עסקים · חשבונית מס נשלחה במייל.'
          }
        />

        <div className={styles.actions}>
          <NewsButton
            href={`/${locale}/store`}
            variant="red"
            size="lg"
            trailing={<span aria-hidden>←</span>}
          >
            חזרה לחנות
          </NewsButton>
        </div>
      </div>
    </div>
  );
}

function shortId(id: string): string {
  return `TR-${id.slice(0, 8).toUpperCase()}`;
}

function itemCount(order: MerchOrder): number {
  return order.items.reduce((sum, i) => sum + i.quantity, 0);
}
