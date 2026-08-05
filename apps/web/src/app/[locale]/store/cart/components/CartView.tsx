'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { NewsButton, PressInput, Receipt } from '@/components/press';
import {
  useMerchCartStore,
  cartSubtotal,
  cartShipping,
  cartTotal,
} from '@/stores/merchCartStore';
import {
  MERCH_FREE_SHIPPING_THRESHOLD_ILS,
  MERCH_MAX_QTY_PER_LINE,
} from '@sync/shared';
import type { CheckoutRequest, CheckoutResponse, ShippingAddress } from '@sync/shared';
import type { Locale } from '@/lib/i18n';
import { QtyStepper } from '../../components/QtyStepper';
import styles from './CartView.module.css';

const GENERIC_ERROR = 'משהו השתבש אצלנו, לא אצלכם. נסו שוב בעוד רגע.';
const REQUIRED_MSG = 'צריך למלא את השדה הזה כדי להמשיך.';
const EMAIL_MSG = 'כתובת האימייל לא נראית תקינה. אפשר לבדוק שוב?';

type FormState = Omit<ShippingAddress, 'country'>;
type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  fullName: '',
  email: '',
  phone: '',
  street: '',
  city: '',
  zip: '',
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

interface CartViewProps {
  locale: Locale;
}

export function CartView({ locale }: CartViewProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const items = useMerchCartStore((s) => s.items);
  const updateQty = useMerchCartStore((s) => s.updateQty);
  const removeItem = useMerchCartStore((s) => s.removeItem);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const subtotal = cartSubtotal(items);
  const shipping = cartShipping(items);
  const total = cartTotal(items);
  const freeShippingReached = subtotal >= MERCH_FREE_SHIPPING_THRESHOLD_ILS;

  const setField = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    (Object.keys(EMPTY_FORM) as (keyof FormState)[]).forEach((k) => {
      if (!form[k].trim()) next[k] = REQUIRED_MSG;
    });
    if (form.email.trim() && !isEmail(form.email.trim())) {
      next.email = EMAIL_MSG;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCheckout = async () => {
    setSubmitError(null);
    if (items.length === 0) return;

    // Checkout requires sign-in - send guests to sign-in and back to the cart.
    if (!isAuthenticated) {
      router.push(`/${locale}/sign-in?redirect=/${locale}/store/cart`);
      return;
    }

    if (!validate()) return;

    setSubmitting(true);
    try {
      const body: CheckoutRequest = {
        items: items.map((i) => ({
          slug: i.slug,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        shipping: { ...form, country: 'IL' },
      };

      const res = await fetch('/api/merch/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        router.push(`/${locale}/sign-in?redirect=/${locale}/store/cart`);
        return;
      }
      if (!res.ok) throw new Error('checkout failed');

      const data = (await res.json()) as CheckoutResponse;
      if (!data?.url) throw new Error('no redirect url');

      window.location.href = data.url;
    } catch {
      setSubmitError(GENERIC_ERROR);
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className={styles.cart}>
        <div className={styles.inner}>
          <header className={styles.head}>
            <span className={styles.kicker}>
              <span aria-hidden className={styles.kickerTick} />
              העגלה · CART
            </span>
          </header>
          <div className={styles.ruleHeavy} aria-hidden />
          <div className={styles.empty}>
            <p className={styles.emptyText}>העגלה ריקה.</p>
            <NewsButton
              href={`/${locale}/store`}
              variant="red"
              size="lg"
              trailing={<span aria-hidden>←</span>}
            >
              למחלקת החנות
            </NewsButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.cart}>
      <div className={styles.inner}>
        <header className={styles.head}>
          <span className={styles.kicker}>
            <span aria-hidden className={styles.kickerTick} />
            העגלה · CART
          </span>
          <h1 className={styles.headline}>
            סקירת <span className={styles.red}>ההזמנה.</span>
          </h1>
        </header>

        <div className={styles.ruleHeavy} aria-hidden />

        <div className={styles.layout}>
          {/* Ledger */}
          <section className={styles.ledger} aria-label="פריטים בעגלה">
            <ul className={styles.lines}>
              {items.map((i) => (
                <li key={`${i.productId}:${i.variantId}`} className={styles.line}>
                  <div className={styles.lineMain}>
                    <Link
                      href={`/${locale}/store/${i.slug}`}
                      className={styles.lineName}
                    >
                      {i.name}
                    </Link>
                    <span className={styles.lineVariant}>{i.variantLabel}</span>
                    <span className={styles.lineUnit}>₪{i.unitPriceILS} ליחידה</span>
                  </div>

                  <div className={styles.lineControls}>
                    <QtyStepper
                      value={i.quantity}
                      onChange={(q) => updateQty(i.productId, i.variantId, q)}
                      min={1}
                      max={MERCH_MAX_QTY_PER_LINE}
                    />
                    <span className={styles.lineTotal}>
                      ₪{i.unitPriceILS * i.quantity}
                    </span>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => removeItem(i.productId, i.variantId)}
                      aria-label={`הסרת ${i.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <Receipt
              className={styles.totals}
              kicker="סיכום · SUMMARY"
              rows={[
                { label: 'סכום ביניים', value: `₪${subtotal}` },
                {
                  label: 'משלוח',
                  value: shipping === 0 ? 'חינם' : `₪${shipping}`,
                },
                { label: 'סך הכל לתשלום', value: `₪${total}`, strong: true },
              ]}
              footer={
                freeShippingReached
                  ? 'משלוח חינם: חציתם את ₪250.'
                  : 'משלוח חינם מעל ₪250.'
              }
            />
          </section>

          {/* Checkout form */}
          <section className={styles.checkout} aria-label="פרטי משלוח">
            <h2 className={styles.checkoutHead}>פרטי משלוח</h2>

            <div className={styles.formGrid}>
              <PressInput
                label="שם מלא"
                value={form.fullName}
                onChange={(e) => setField('fullName', e.currentTarget.value)}
                error={errors.fullName}
                autoComplete="name"
                className={styles.span2}
              />
              <PressInput
                label="אימייל"
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => setField('email', e.currentTarget.value)}
                error={errors.email}
                autoComplete="email"
                dir="ltr"
              />
              <PressInput
                label="טלפון"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.currentTarget.value)}
                error={errors.phone}
                autoComplete="tel"
                dir="ltr"
              />
              <PressInput
                label="רחוב ומספר"
                value={form.street}
                onChange={(e) => setField('street', e.currentTarget.value)}
                error={errors.street}
                autoComplete="address-line1"
                className={styles.span2}
              />
              <PressInput
                label="עיר"
                value={form.city}
                onChange={(e) => setField('city', e.currentTarget.value)}
                error={errors.city}
                autoComplete="address-level2"
              />
              <PressInput
                label="מיקוד"
                inputMode="numeric"
                value={form.zip}
                onChange={(e) => setField('zip', e.currentTarget.value)}
                error={errors.zip}
                autoComplete="postal-code"
                dir="ltr"
              />
            </div>

            <p className={styles.countryNote}>
              <span aria-hidden className={styles.trustMark}>
                ■
              </span>
              משלוח לישראל בלבד · תשלום מאובטח בשקלים.
            </p>

            {submitError ? (
              <p className={styles.submitError} role="alert">
                <span aria-hidden>✕ </span>
                {submitError}
              </p>
            ) : null}

            <div className={styles.actionBar}>
              <NewsButton
                variant="red"
                size="lg"
                onClick={handleCheckout}
                disabled={submitting}
                trailing={<span aria-hidden>←</span>}
              >
                {submitting ? 'רגע…' : `למעבר לתשלום · ₪${total}`}
              </NewsButton>
              <Link href={`/${locale}/store`} className={styles.keepShopping}>
                המשך קנייה ↑
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
