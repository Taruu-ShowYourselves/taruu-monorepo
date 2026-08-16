'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { isMunicipality } from '@/components/uikit/municipality-link';
import { VotesHero } from './VotesHero';
import { VotesList } from './VotesList';
import type { VoteFilter } from './types';
import type { Locale } from '@/lib/i18n';

interface VotesViewProps {
  locale?: Locale;
}

export function VotesView({ locale = 'he' }: VotesViewProps) {
  const [activeFilter, setActiveFilter] = useState<VoteFilter>('all');
  // null = nationwide edition; a name = that municipality's desk.
  const [scope, setScope] = useState<string | null>(null);
  const [scopeTouched, setScopeTouched] = useState(false);
  const { user } = useAuth();

  const homeMunicipality =
    user?.municipality && isMunicipality(user.municipality)
      ? user.municipality
      : null;

  // Location base: once the reader's profile arrives, open on their own
  // desk - unless they already picked a scope themselves.
  useEffect(() => {
    if (scopeTouched || !homeMunicipality) return;
    setScope(homeMunicipality);
  }, [homeMunicipality, scopeTouched]);

  const handleScopeChange = (next: string | null) => {
    setScopeTouched(true);
    setScope(next);
  };

  return (
    <>
      <VotesHero
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        scope={scope}
        homeMunicipality={homeMunicipality}
        onScopeChange={handleScopeChange}
        locale={locale}
      />
      <VotesList filter={activeFilter} municipality={scope} locale={locale} />
    </>
  );
}
