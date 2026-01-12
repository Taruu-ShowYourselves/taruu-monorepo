import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/sections/Hero';
import { Features } from '@/components/sections/Features';
import { HowItWorks } from '@/components/sections/HowItWorks';
import { Pilot } from '@/components/sections/Pilot';
import { Stats } from '@/components/sections/Stats';
import { Newsletter } from '@/components/sections/Newsletter';
import { CTA } from '@/components/sections/CTA';

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pilot />
        <Stats />
        <Newsletter />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
