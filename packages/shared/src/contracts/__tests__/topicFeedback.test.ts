import { describe, expect, it } from 'vitest';
import {
  SetAsideReasonSchema,
  SetTopicAsideSchema,
  TopicAsideStandingSchema,
} from '../topicFeedback';

const TOPIC_ID = '3f1a6d2e-9c4b-4a2f-8e1d-7b5c0a9f2d3e';

describe('SetAsideReasonSchema', () => {
  it('accepts every reason the table CHECKs', () => {
    // Drifting apart from the migration's CHECK constraint is the one way this
    // contract can pass its own tests and still 500 on write.
    for (const reason of [
      'not_consensus',
      'already_decided',
      'unclear',
      'not_my_authority',
    ]) {
      expect(SetAsideReasonSchema.safeParse(reason).success).toBe(true);
    }
  });

  it('refuses free text', () => {
    expect(SetAsideReasonSchema.safeParse('because I said so').success).toBe(false);
  });
});

describe('SetTopicAsideSchema', () => {
  it('takes a reason and nothing else', () => {
    const parsed = SetTopicAsideSchema.safeParse({ reason: 'unclear' });
    expect(parsed.success && parsed.data.reason).toBe('unclear');
  });

  it('refuses a payload with no reason', () => {
    expect(SetTopicAsideSchema.safeParse({}).success).toBe(false);
  });

  it('does not let the caller name the reader', () => {
    // The reader comes from the session, never the body. If this ever starts
    // passing, anybody can set a topic aside as somebody else.
    const parsed = SetTopicAsideSchema.parse({
      reason: 'not_consensus',
      userId: 'someone-else',
    });
    expect(parsed).not.toHaveProperty('userId');
  });
});

describe('TopicAsideStandingSchema', () => {
  it('reads a standing with no reason of its own', () => {
    const parsed = TopicAsideStandingSchema.safeParse({
      topicId: TOPIC_ID,
      asideCount: 4,
      ownReason: null,
    });
    expect(parsed.success).toBe(true);
  });

  it('refuses a negative count', () => {
    expect(
      TopicAsideStandingSchema.safeParse({
        topicId: TOPIC_ID,
        asideCount: -1,
        ownReason: null,
      }).success
    ).toBe(false);
  });

  it('carries no reviewer identity', () => {
    // The public shape is a count plus the caller's own standing. A name here
    // would make "who thinks this is not a real topic" a published fact.
    const shape = Object.keys(TopicAsideStandingSchema.shape);
    expect(shape).toEqual(['topicId', 'asideCount', 'ownReason']);
  });
});
