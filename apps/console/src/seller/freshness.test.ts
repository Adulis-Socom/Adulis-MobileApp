import { describe, expect, it } from 'vitest';
import { fresher, tick } from './freshness';

const held = (version: number, title: string, stamp: number) => ({ value: { version, title }, stamp });

describe('freshness: an older answer never overwrites a newer acknowledged one', () => {
  it('takes the first answer when there is none yet', () => {
    const first = held(1, 'first', tick());
    expect(fresher(null, first)).toBe(first);
  });

  it('decides by version when the versions differ, whatever the stamps say', () => {
    const acknowledged = held(7, 'after my save', 10);
    expect(fresher(acknowledged, held(6, 'a slow, older read', 99))).toBe(acknowledged);
    const newer = held(8, 'a genuinely newer read', 1);
    expect(fresher(acknowledged, newer)).toBe(newer);
  });

  it('with equal versions, a read issued BEFORE the write was acknowledged cannot replace it', () => {
    const readIssued = tick();
    const writeAcked = held(7, 'my acknowledged save, with its derived facts', tick());
    const lateRead = held(7, 'answered late, derived facts from before my save', readIssued);
    expect(fresher(writeAcked, lateRead)).toBe(writeAcked);
  });

  it('with equal versions, a read issued AFTER the acknowledgement brings legitimately updated derived facts', () => {
    const writeAcked = held(7, 'my acknowledged save', tick());
    const laterRead = held(7, 'same version, readiness changed on the server', tick());
    expect(fresher(writeAcked, laterRead)).toBe(laterRead);
  });

  it('stamps are strictly increasing', () => {
    const a = tick();
    expect(tick()).toBeGreaterThan(a);
  });
});
