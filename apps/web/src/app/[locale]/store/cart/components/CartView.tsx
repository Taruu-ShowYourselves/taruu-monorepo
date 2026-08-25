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
import { paymentsEnabled } from '@/lib/payments-flag';
import { QtyStepper } from '../../components/QtyStepper';
import styles from './CartView.module.css';
import { localePrefix } from '@/lib/i18n';

/**
 * The store cannot charge while payments are off, so the checkout affordance is
 * a coming-soon stamp rather than a button that would 503. Read once at module
 * scope: NEXT_PUBLIC_PAYMENTS_ENABLED is inlined at build time.
 */
const PAYMENTS_OPEN = paymentsEnabled();

interface CartViewCopy {
  genericError: string;
  requiredMsg: string;
  emailMsg: string;
  kicker: string;
  emptyText: string;
  emptyCta: string;
  headline: string;
  headlineRed: string;
  ledgerAria: string;
  perUnit: (n: number) => string;
  removeAria: (name: string) => string;
  summaryKicker: string;
  subtotalLabel: string;
  shippingLabel: string;
  freeLabel: string;
  totalLabel: string;
  freeShippingReached: string;
  freeShippingHint: string;
  checkoutAria: string;
  checkoutHead: string;
  fullNameLabel: string;
  emailLabel: string;
  phoneLabel: string;
  streetLabel: string;
  cityLabel: string;
  zipLabel: string;
  countryNote: string;
  submitting: string;
  checkoutCta: (total: number) => string;
  /** Coming-soon copy. A condition, never a date - and nothing is collected. */
  checkoutSoonLabel: string;
  checkoutSoonNote: string;
  keepShopping: string;
  arrow: string;
}

const COPY: Record<Locale, CartViewCopy> = {
  he: {
    genericError: 'משהו השתבש אצלנו, לא אצלכם. נסו שוב בעוד רגע.',
    requiredMsg: 'צריך למלא את השדה הזה כדי להמשיך.',
    emailMsg: 'כתובת האימייל לא נראית תקינה. אפשר לבדוק שוב?',
    kicker: 'העגלה · CART',
    emptyText: 'העגלה ריקה.',
    emptyCta: 'למחלקת החנות',
    headline: 'סקירת',
    headlineRed: 'ההזמנה.',
    ledgerAria: 'פריטים בעגלה',
    perUnit: (n) => `₪${n} ליחידה`,
    removeAria: (name) => `הסרת ${name}`,
    summaryKicker: 'סיכום · SUMMARY',
    subtotalLabel: 'סכום ביניים',
    shippingLabel: 'משלוח',
    freeLabel: 'חינם',
    totalLabel: 'סך הכל לתשלום',
    freeShippingReached: 'משלוח חינם: חציתם את ₪250.',
    freeShippingHint: 'משלוח חינם מעל ₪250.',
    checkoutAria: 'פרטי משלוח',
    checkoutHead: 'פרטי משלוח',
    fullNameLabel: 'שם מלא',
    emailLabel: 'אימייל',
    phoneLabel: 'טלפון',
    streetLabel: 'רחוב ומספר',
    cityLabel: 'עיר',
    zipLabel: 'מיקוד',
    countryNote: 'משלוח לישראל בלבד · תשלום מאובטח בשקלים.',
    submitting: 'רגע…',
    checkoutCta: (total) => `למעבר לתשלום · ₪${total}`,
    checkoutSoonLabel: 'התשלום ייפתח בקרוב',
    checkoutSoonNote:
      'המעבר לתשלום עדיין לא נפתח. אפשר להשאיר את הפריטים בעגלה - הם נשמרים כאן עד שהחנות תיפתח לתשלום.',
    keepShopping: 'המשך קנייה ↑',
    arrow: '←',
  },
  en: {
    genericError: 'Something went wrong on our side, not yours. Try again in a moment.',
    requiredMsg: 'This field is needed to continue.',
    emailMsg: 'The email address does not look valid. Care to check it?',
    kicker: 'The Cart · CHECKOUT',
    emptyText: 'The cart is empty.',
    emptyCta: 'To the store desk',
    headline: 'Reviewing the',
    headlineRed: 'order.',
    ledgerAria: 'Items in the cart',
    perUnit: (n) => `₪${n} per unit`,
    removeAria: (name) => `Remove ${name}`,
    summaryKicker: 'The Tally · SUMMARY',
    subtotalLabel: 'Subtotal',
    shippingLabel: 'Shipping',
    freeLabel: 'Free',
    totalLabel: 'Total due',
    freeShippingReached: 'Free shipping: you have passed ₪250.',
    freeShippingHint: 'Free shipping over ₪250.',
    checkoutAria: 'Shipping details',
    checkoutHead: 'Shipping details',
    fullNameLabel: 'Full name',
    emailLabel: 'Email',
    phoneLabel: 'Phone',
    streetLabel: 'Street and number',
    cityLabel: 'City',
    zipLabel: 'Postal code',
    countryNote: 'Shipping within Israel only · Secure payment in shekels.',
    submitting: 'One moment…',
    checkoutCta: (total) => `Proceed to payment · ₪${total}`,
    checkoutSoonLabel: 'Checkout opens soon',
    checkoutSoonNote:
      'Checkout has not opened yet. You can leave the items in the cart - they are kept here until the store opens for payment.',
    keepShopping: 'Continue shopping ↑',
    arrow: '→',
  },
};

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
  const t = COPY[locale];

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
      if (!form[k].trim()) next[k] = t.requiredMsg;
    });
    if (form.email.trim() && !isEmail(form.email.trim())) {
      next.email = t.emailMsg;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCheckout = async () => {
    setSubmitError(null);
    // Belt and braces: the button is disabled while payments are off, and
    // /api/merch/checkout answers 503 regardless.
    if (!PAYMENTS_OPEN) return;
    if (items.length === 0) return;

    // Checkout requires sign-in - send guests to sign-in and back to the cart.
    if (!isAuthenticated) {
      router.push(`${localePrefix(locale)}/sign-in?redirect=${localePrefix(locale)}/store/cart`);
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
        router.push(`${localePrefix(locale)}/sign-in?redirect=${localePrefix(locale)}/store/cart`);
        return;
      }
      if (!res.ok) throw new Error('checkout failed');

      const data = (await res.json()) as CheckoutResponse;
      if (!data?.url) throw new Error('no redirect url');

      window.location.href = data.url;
    } catch {
      setSubmitError(t.genericError);
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
              {t.kicker}
            </span>
          </header>
          <div className={styles.ruleHeavy} aria-hidden />
          <div className={styles.empty}>
            <p className={styles.emptyText}>{t.emptyText}</p>
            <NewsButton
              href={`${localePrefix(locale)}/store`}
              variant="red"
              size="lg"
              trailing={<span aria-hidden>{t.arrow}</span>}
            >
              {t.emptyCta}
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
            {t.kicker}
          </span>
          <h1 className={styles.headline}>
            {t.headline} <span className={styles.red}>{t.headlineRed}</span>
          </h1>
        </header>

        <div className={styles.ruleHeavy} aria-hidden />

        <div className={styles.layout}>
          {/* Ledger */}
          <section className={styles.ledger} aria-label={t.ledgerAria}>
            <ul className={styles.lines}>
              {items.map((i) => (
                <li key={`${i.productId}:${i.variantId}`} className={styles.line}>
                  <div className={styles.lineMain}>
                    <Link
                      href={`${localePrefix(locale)}/store/${i.slug}`}
                      className={styles.lineName}
                    >
                      {i.name}
                    </Link>
                    <span className={styles.lineVariant}>{i.variantLabel}</span>
                    <span className={styles.lineUnit}>{t.perUnit(i.unitPriceILS)}</span>
                  </div>

                  <div className={styles.lineControls}>
                    <QtyStepper
                      value={i.quantity}
                      onChange={(q) => updateQty(i.productId, i.variantId, q)}
                      min={1}
                      max={MERCH_MAX_QTY_PER_LINE}
                      locale={locale}
                    />
                    <span className={styles.lineTotal}>
                      ₪{i.unitPriceILS * i.quantity}
                    </span>
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => removeItem(i.productId, i.variantId)}
                      aria-label={t.removeAria(i.name)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <Receipt
              className={styles.totals}
              kicker={t.summaryKicker}
              rows={[
                { label: t.subtotalLabel, value: `₪${subtotal}` },
                {
                  label: t.shippingLabel,
                  value: shipping === 0 ? t.freeLabel : `₪${shipping}`,
                },
                { label: t.totalLabel, value: `₪${total}`, strong: true },
              ]}
              footer={
                freeShippingReached
                  ? t.freeShippingReached
                  : t.freeShippingHint
              }
            />
          </section>

          {/* Checkout form */}
          <section className={styles.checkout} aria-label={t.checkoutAria}>
            <h2 className={styles.checkoutHead}>{t.checkoutHead}</h2>

            <div className={styles.formGrid}>
              <PressInput
                label={t.fullNameLabel}
                value={form.fullName}
                onChange={(e) => setField('fullName', e.currentTarget.value)}
                error={errors.fullName}
                autoComplete="name"
                className={styles.span2}
              />
              <PressInput
                label={t.emailLabel}
                type="email"
                inputMode="email"
                value={form.email}
                onChange={(e) => setField('email', e.currentTarget.value)}
                error={errors.email}
                autoComplete="email"
                dir="ltr"
              />
              <PressInput
                label={t.phoneLabel}
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setField('phone', e.currentTarget.value)}
                error={errors.phone}
                autoComplete="tel"
                dir="ltr"
              />
              <PressInput
                label={t.streetLabel}
                value={form.street}
                onChange={(e) => setField('street', e.currentTarget.value)}
                error={errors.street}
                autoComplete="address-line1"
                className={styles.span2}
              />
              <PressInput
                label={t.cityLabel}
                value={form.city}
                onChange={(e) => setField('city', e.currentTarget.value)}
                error={errors.city}
                autoComplete="address-level2"
              />
              <PressInput
                label={t.zipLabel}
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
              {PAYMENTS_OPEN ? t.countryNote : t.checkoutSoonNote}
            </p>

            {submitError ? (
              <p className={styles.submitError} role="alert">
                <span aria-hidden>✕ </span>
                {submitError}
              </p>
            ) : null}

            <div className={styles.actionBar}>
              <NewsButton
                variant={PAYMENTS_OPEN ? 'red' : 'outline'}
                size="lg"
                onClick={handleCheckout}
                disabled={submitting || !PAYMENTS_OPEN}
                aria-disabled={!PAYMENTS_OPEN}
                trailing={PAYMENTS_OPEN ? <span aria-hidden>{t.arrow}</span> : undefined}
              >
                {!PAYMENTS_OPEN
                  ? t.checkoutSoonLabel
                  : submitting
                    ? t.submitting
                    : t.checkoutCta(total)}
              </NewsButton>
              <Link href={`${localePrefix(locale)}/store`} className={styles.keepShopping}>
                {t.keepShopping}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
