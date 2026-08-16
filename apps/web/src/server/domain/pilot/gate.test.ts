import { describe, expect, it } from 'vitest';
import { decidePilotGate } from './gate';

describe('pilot vote gate', () => {
  const active = new Set(['תל אביב-יפו']);

  it('leaves non-pilot votes alone', () => {
    expect(decidePilotGate('חיפה', active, 'ירושלים')).toEqual({ allowed: true });
  });

  it('allows the matching municipality', () => {
    expect(decidePilotGate('תל אביב-יפו', active, 'תל אביב-יפו')).toEqual({ allowed: true });
  });

  it('blocks a different or unknown municipality', () => {
    expect(decidePilotGate('תל אביב-יפו', active, 'חיפה')).toEqual({
      allowed: false,
      code: 'PILOT_MUNICIPALITY_ONLY',
    });
    expect(decidePilotGate('תל אביב-יפו', active, null)).toEqual({
      allowed: false,
      code: 'PILOT_MUNICIPALITY_ONLY',
    });
  });
});
