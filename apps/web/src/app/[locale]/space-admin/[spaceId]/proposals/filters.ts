/**
 * The proposals surface's filter vocabulary, in a module with NO `'use client'`
 * directive - which is the whole reason this file exists.
 *
 * `page.tsx` is a Server Component and needs three of these values to turn
 * `?status=` into an authorized read. They used to live in `ProposalsClient.tsx`,
 * and importing a non-component value from a `'use client'` module into a
 * Server Component does not do what it looks like: React replaces the module
 * with client references, so `PROPOSAL_FILTERS.includes(…)` threw at request
 * time and `DEFAULT_PROPOSAL_FILTER` arrived as a reference rather than as
 * `'in_review'` - which silently became a malformed query and rendered
 * `ErrorPanel` on the surface's own default view.
 *
 * None of that is visible to `tsc`, and `apps/web`'s vitest suite runs with
 * `environment: 'node'` and Supabase mocked, so no test could see it either.
 * It was found in 05-16 by loading the page in a browser.
 *
 * The rule this file encodes: a value a Server Component reads must not live in
 * a client module. Types are exempt - they are erased before either side runs.
 */

export type ProposalsFilter =
  | 'in_review'
  | 'draft'
  | 'changes_requested'
  | 'rejected'
  | 'active'
  | 'all';

export const PROPOSAL_FILTERS: readonly ProposalsFilter[] = [
  'in_review',
  'draft',
  'changes_requested',
  'rejected',
  'active',
  'all',
];

/** The queue opens on what needs a decision. */
export const DEFAULT_PROPOSAL_FILTER: ProposalsFilter = 'in_review';
