import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { DownloadHero } from './components/DownloadHero';
import { AppFeatures } from './components/AppFeatures';

export const metadata: Metadata = {
  title: 'הורדת האפליקציה',
  description:
    'הורידו את אפליקציית סינק ל-iOS ו-Android והתחילו להשפיע על הקהילה שלכם.',
};

export default function DownloadPage() {
  return (
    <>
      <Header />
      <main>
        <DownloadHero />
        <AppFeatures />
      </main>
      <Footer />
    </>
  );
}
