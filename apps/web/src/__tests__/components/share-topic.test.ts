import { describe, expect, it } from 'vitest';
import {
  shareTopicClipboard,
  shareTopicPayload,
  type ShareTopicFacts,
} from '@/components/press/sections/shareTopic';

const FACTS: ShareTopicFacts = {
  headline: 'איחוד רגולטורי השידורים תחת רשות אחת חדשה',
  authority: 'כנסת ישראל',
  forPct: 62,
  againstPct: 31,
  ballots: 1240,
  participants: 980,
  daysLeft: 13,
  url: 'https://taruu.co.il/votes/abc',
};

describe('shareTopicPayload', () => {
  it('leads with the ballot name and titles the share with it', () => {
    const payload = shareTopicPayload(FACTS, 'he');
    expect(payload.title).toBe(FACTS.headline);
    expect(payload.text.split('\n')[0]).toBe(FACTS.headline);
  });

  it('always states that voting needs a verified citizen', () => {
    expect(shareTopicPayload(FACTS, 'he').text).toContain('אזרח מאומת');
    expect(shareTopicPayload(FACTS, 'en').text).toContain('verified citizen');
  });

  it('stamps the standing as it was at the moment of sharing', () => {
    const text = shareTopicPayload(FACTS, 'he').text;
    expect(text).toContain('62% בעד');
    expect(text).toContain('31% נגד');
    expect(text).toContain('1,240');
  });

  it('says a ballot nobody has answered is open rather than printing a count', () => {
    const text = shareTopicPayload({ ...FACTS, ballots: 0 }, 'he').text;
    expect(text).toContain('טרם נספרו קולות');
    expect(text).not.toContain('0 קולות נספרו');
  });

  it('does not promise days left on a ballot that has closed', () => {
    expect(shareTopicPayload({ ...FACTS, daysLeft: -1 }, 'he').text).toContain(
      'ההצבעה נסגרה'
    );
    expect(shareTopicPayload({ ...FACTS, daysLeft: 1 }, 'he').text).toContain(
      'מסתיים היום'
    );
    expect(shareTopicPayload({ ...FACTS, daysLeft: -3 }, 'en').text).toContain(
      'Voting closed'
    );
  });

  it('keeps the url out of the body so a share sheet does not print it twice', () => {
    expect(shareTopicPayload(FACTS, 'he').text).not.toContain(FACTS.url);
    expect(shareTopicPayload(FACTS, 'he').url).toBe(FACTS.url);
  });

  it('appends the url for platforms with no share sheet', () => {
    const payload = shareTopicPayload(FACTS, 'he');
    expect(shareTopicClipboard(payload)).toBe(`${payload.text}\n${FACTS.url}`);
  });
});
