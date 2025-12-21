import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { AboutHero } from './components/AboutHero';
import { Mission } from './components/Mission';
import { Technology } from './components/Technology';
import { Team } from './components/Team';
import { CTA } from '@/components/sections/CTA';

export const metadata: Metadata = {
  title: 'אודות',
  description:
    'למדו על החזון שלנו, הטכנולוגיה מאחורי סינק, והצוות שעומד מאחורי הפלטפורמה.',
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main>
        <AboutHero />
        <Mission />
        <Technology />
        <Team />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
