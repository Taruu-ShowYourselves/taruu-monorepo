import { describe, expect, it } from 'vitest';
import {
  generateAvailablePilotLinkCode,
  generatePilotLinkCode,
  isPilotBotUserAgent,
  PILOT_LINK_CODE_LENGTH,
} from './link-code';

describe('pilot link codes', () => {
  it('uses eight lowercase ambiguity-free characters', () => {
    const code = generatePilotLinkCode((bytes) => bytes.fill(255));
    expect(code).toHaveLength(PILOT_LINK_CODE_LENGTH);
    expect(code).toMatch(/^[a-z0-9]{8}$/);
    expect(code).not.toMatch(/[01ilo]/);
  });

  it('retries one collision', async () => {
    const candidates = ['abcdefgh', 'qrstuvwx'];
    const code = await generateAvailablePilotLinkCode(
      async (candidate) => candidate === 'abcdefgh',
      () => candidates.shift()!
    );
    expect(code).toBe('qrstuvwx');
  });

  it('fails after two collisions', async () => {
    await expect(
      generateAvailablePilotLinkCode(async () => true, () => 'abcdefgh')
    ).rejects.toThrow('unique pilot link code');
  });
});

describe('pilot crawler classification', () => {
  it.each(['facebookexternalhit/1.1', 'WhatsApp/2.26', 'Googlebot', 'curl/8'])('%s is a bot', (ua) => {
    expect(isPilotBotUserAgent(ua)).toBe(true);
  });

  it('keeps a normal in-app browser hit human', () => {
    expect(
      isPilotBotUserAgent(
        'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS]'
      )
    ).toBe(false);
  });
});
