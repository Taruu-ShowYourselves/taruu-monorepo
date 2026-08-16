import { describe, expect, it } from 'vitest';
import {
  CAPABILITIES,
  CAPABILITY_LABELS_HE,
  ROLE_PRESETS,
  ROLE_PRESET_LABELS_HE,
  expandPreset,
  isCapability,
  type Capability,
  type RolePreset,
} from './capability';

/**
 * The eleven capability-manifest rows from 05-UI-SPEC.md "Surface 1", verbatim
 * and in spec order. If this array and CAPABILITY_LABELS_HE ever disagree, the
 * dashboard is advertising an authority the server does not model (or hiding
 * one it does), so the drift is a test failure rather than a review comment.
 */
const UI_SPEC_MANIFEST_LABELS = [
  'לבדוק הצעות',
  'לאשר ולפרסם הצעות',
  'לדחות הצעות',
  'לצפות ברשימת החברים',
  'להשעות חברים במרחב',
  'להעניק הרשאות',
  'לשלול הרשאות',
  'לנהל תוכן מותר',
  'לצפות בנתונים מצטברים',
  'לשלוח התראות לתושבים',
  'לצפות ביומן הפעולות',
] as const;

describe('CAPABILITIES', () => {
  it('is a closed vocabulary of exactly eleven actions', () => {
    expect(CAPABILITIES).toHaveLength(11);
    expect(new Set(CAPABILITIES).size).toBe(11);
  });

  it('carries no "space.read" - reaching the shell is membership, not a capability', () => {
    expect(CAPABILITIES).not.toContain('space.read' as Capability);
  });

  it('has one capability per UI manifest row, in spec order', () => {
    expect(CAPABILITIES.map((c) => CAPABILITY_LABELS_HE[c])).toEqual([
      ...UI_SPEC_MANIFEST_LABELS,
    ]);
  });
});

describe('CAPABILITY_LABELS_HE', () => {
  it.each(CAPABILITIES)('labels %s in Hebrew', (capability) => {
    const label = CAPABILITY_LABELS_HE[capability];
    expect(label).toBeTypeOf('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('has no key that is not a capability', () => {
    expect(Object.keys(CAPABILITY_LABELS_HE).sort()).toEqual([...CAPABILITIES].sort());
  });

  it('contains no Latin characters - every label is product Hebrew', () => {
    for (const label of Object.values(CAPABILITY_LABELS_HE)) {
      expect(label).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe('ROLE_PRESETS', () => {
  it('expands space_admin to every capability', () => {
    expect([...expandPreset('space_admin')].sort()).toEqual([...CAPABILITIES].sort());
  });

  it('expands space_observer to read-only metrics and audit', () => {
    expect(expandPreset('space_observer')).toEqual(['metrics.read', 'audit.read']);
  });

  it('names no capability outside the vocabulary', () => {
    for (const capabilities of Object.values(ROLE_PRESETS)) {
      for (const capability of capabilities) {
        expect(isCapability(capability)).toBe(true);
      }
    }
  });

  it('names no preset twice within itself', () => {
    for (const [preset, capabilities] of Object.entries(ROLE_PRESETS)) {
      expect(new Set(capabilities).size, preset).toBe(capabilities.length);
    }
  });

  it('labels every preset in Hebrew', () => {
    const presets = Object.keys(ROLE_PRESETS) as RolePreset[];
    expect(Object.keys(ROLE_PRESET_LABELS_HE).sort()).toEqual([...presets].sort());
    for (const label of Object.values(ROLE_PRESET_LABELS_HE)) {
      expect(label).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe('isCapability', () => {
  it('accepts a member of the vocabulary', () => {
    expect(isCapability('proposal.approve')).toBe(true);
  });

  it('rejects an invented action', () => {
    expect(isCapability('proposal.destroy')).toBe(false);
  });

  it('rejects the empty string and near-misses', () => {
    expect(isCapability('')).toBe(false);
    expect(isCapability('Proposal.Approve')).toBe(false);
  });
});
