import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { getProductBySlug, localizeProduct, MERCH_CATALOG } from '@/lib/merch/catalog';
import type { Locale } from '@/lib/i18n';
import { ProductDetail } from '../components/ProductDetail';

const NOT_FOUND_TITLE: Record<Locale, string> = {
  he: 'מוצר לא נמצא | תַּרְאוּ',
  en: 'Product not found | Taruu',
};

const TITLE_SUFFIX: Record<Locale, string> = {
  he: 'חנות המערכת',
  en: 'The Store',
};

interface ProductPageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

export function generateStaticParams() {
  return MERCH_CATALOG.filter((p) => p.active).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: NOT_FOUND_TITLE[locale] };
  const localized = localizeProduct(product, locale);
  return {
    title: `${localized.name} | ${TITLE_SUFFIX[locale]}`,
    description: localized.description,
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { locale, slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) notFound();

  return (
    <>
      <Header locale={locale} />
      <main>
        <ProductDetail product={localizeProduct(product, locale)} locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
