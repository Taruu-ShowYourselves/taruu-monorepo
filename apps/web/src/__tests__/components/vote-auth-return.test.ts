/**
 * The return target a guest carries through sign-in.
 *
 * What is being defended: a reader pushed a tile, was asked for an account,
 * and must come back to the position they took. Every case below is a way of
 * losing it - dropping the option, dropping the locale, or handing the OAuth
 * callback a target its redirect guard will refuse.
 */

import { describe, expect, it } from 'vitest';
import { voteReturnPath } from '@/components/press/sections/voteAuthReturn';
import { safeRedirect } from '@/lib/safeRedirect';

const DESK = '/?edition=haifa';

describe('voteReturnPath', () => {
  it('returns a side to its own ballot with the choice already made', () => {
    expect(
      voteReturnPath(
        { intent: 'for', voteId: 'v-1', optionId: 'opt-yes', currentPath: DESK },
        'he'
      )
    ).toBe('/votes/v-1?option=opt-yes');
  });

  it('keeps the reader in their locale', () => {
    expect(
      voteReturnPath(
        { intent: 'against', voteId: 'v-1', optionId: 'opt-no', currentPath: DESK },
        'en'
      )
    ).toBe('/en/votes/v-1?option=opt-no');
  });

  it('escapes an option id rather than splicing it into the query', () => {
    expect(
      voteReturnPath(
        { intent: 'for', voteId: 'v-1', optionId: 'a b&c=d', currentPath: DESK },
        'he'
      )
    ).toBe('/votes/v-1?option=a%20b%26c%3Dd');
  });

  it('returns a set-aside push to the desk it was made on', () => {
    expect(
      voteReturnPath({ intent: 'aside', voteId: 'v-1', currentPath: DESK }, 'he')
    ).toBe(DESK);
  });

  it('falls back to the locale home when the side carries no option', () => {
    // A topic whose ballot has no matching side: there is nothing to confirm,
    // so the reader is not sent to a vote page that would ask again.
    expect(voteReturnPath({ intent: 'for', voteId: 'v-1', currentPath: '' }, 'en')).toBe(
      '/en'
    );
    expect(voteReturnPath({ intent: 'for', voteId: 'v-1', currentPath: '' }, 'he')).toBe(
      '/'
    );
  });

  it('never produces a target the post-auth redirect guard would refuse', () => {
    const cases = [
      voteReturnPath(
        { intent: 'for', voteId: 'v-1', optionId: 'opt-yes', currentPath: DESK },
        'en'
      ),
      voteReturnPath({ intent: 'aside', voteId: 'v-1', currentPath: DESK }, 'he'),
      // A hostile "current path" is the only value here the page does not
      // build from constants, so it must not survive into the callback.
      voteReturnPath(
        { intent: 'aside', voteId: 'v-1', currentPath: 'https://evil.example' },
        'he'
      ),
      voteReturnPath(
        { intent: 'aside', voteId: 'v-1', currentPath: '//evil.example' },
        'he'
      ),
    ];
    for (const target of cases) {
      expect(safeRedirect(target, '/dashboard')).toBe(target);
    }
  });
});
