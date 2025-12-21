import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { VotesHero } from './components/VotesHero';
import { VotesList } from './components/VotesList';

export const metadata: Metadata = {
  title: 'הצבעות פומביות',
  description:
    'צפו בהצבעות פעילות, הצבעות שהסתיימו ותוצאות ברשויות המקומיות בישראל.',
};

export default function VotesPage() {
  return (
    <>
      <Header />
      <main>
        <VotesHero />
        <VotesList />
      </main>
      <Footer />
    </>
  );
}
