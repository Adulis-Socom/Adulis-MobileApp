import type { ChatMessage } from './chat';
import { captureBaseline, candidatesFor, type Baseline } from './pending-match';

/**
 * Relating an unconfirmed send to the history. The rows are the parser's own shape; the function reads
 * no clock, so every expectation holds whatever the device's time is.
 */
const at = (s: string) => `2026-11-18T10:00:${s}.000Z`;
let n = 0;
const row = (over: Partial<ChatMessage> & Pick<ChatMessage, 'sentAt'>): ChatMessage => ({
  id: `d0000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  kind: 'BUYER',
  body: 'Is this still available?',
  templateKey: null,
  aboutProduct: false,
  aboutOrder: false,
  escalated: false,
  ...over,
});
const bot = (sentAt: string) => row({ kind: 'BOT', body: null, templateKey: 'chat.bot.escalated', sentAt });
const pending = (baseline: Baseline, over: Partial<{ text: string; aboutProduct: boolean }> = {}) => ({
  text: 'Is this still available?',
  aboutProduct: false,
  baseline,
  ...over,
});

describe('capturing what the history held before an attempt', () => {
  it('is null when the history had not been read', () => {
    expect(captureBaseline({ read: false, items: [] })).toBeNull();
    expect(captureBaseline({ read: false, items: [row({ sentAt: at('01') })] })).toBeNull();
  });

  it('is an empty baseline for a history that was read and holds nothing', () => {
    expect(captureBaseline({ read: true, items: [] })).toEqual({ newestSentAt: null, edgeIds: [] });
  });

  it('keeps the newest instant and every id that shares it (a message and its automated answer)', () => {
    const older = row({ sentAt: at('01') });
    const question = row({ sentAt: at('05') });
    const answer = bot(at('05'));
    expect(captureBaseline({ read: true, items: [answer, question, older] })).toEqual({
      newestSentAt: at('05'),
      edgeIds: [answer.id, question.id],
    });
  });
});

describe('the rows that could be an unconfirmed send', () => {
  it('finds nothing when the history had not been read, even for an identical Buyer row', () => {
    expect(candidatesFor(pending(null), [row({ sentAt: at('30') })])).toEqual([]);
  });

  it('after an empty history, an identical Buyer row is a candidate', () => {
    const stored = row({ sentAt: at('30') });
    expect(candidatesFor(pending({ newestSentAt: null, edgeIds: [] }), [stored])).toEqual([stored]);
  });

  it('an identical message that is not newer than the baseline is not a candidate; a newer one is', () => {
    const earlier = row({ sentAt: at('10') });
    const newer = row({ sentAt: at('40') });
    const baseline = captureBaseline({ read: true, items: [earlier] });
    expect(candidatesFor(pending(baseline), [newer, earlier])).toEqual([newer]);
    expect(candidatesFor(pending(baseline), [earlier])).toEqual([]);
  });

  it('a row at the very instant of the newest baseline row is a candidate only under an id the baseline did not hold', () => {
    const answer = bot(at('20'));
    const earlier = row({ sentAt: at('20') });
    const baseline = captureBaseline({ read: true, items: [answer, earlier] });
    const stored = row({ sentAt: at('20') });
    expect(candidatesFor(pending(baseline), [answer, stored, earlier])).toEqual([stored]);
  });

  // A read that lands after the next, identical message began shows the earlier message too: the server's own
  // answer to that send named its id, so the row is that message and never this one.
  it('a row the server already accepted a send with is never a candidate, whatever the baseline held', () => {
    const accepted = row({ sentAt: at('40') });
    const other = row({ sentAt: at('41') });
    const baseline = { newestSentAt: at('01'), edgeIds: [] };
    expect(candidatesFor(pending(baseline), [other, accepted])).toEqual([other, accepted]);
    expect(candidatesFor(pending(baseline), [other, accepted], [accepted.id])).toEqual([other]);
    expect(
      candidatesFor(pending({ newestSentAt: null, edgeIds: [] }), [accepted], [accepted.id]),
    ).toEqual([]);
  });

  it('a row older than the newest baseline row is never a candidate, however it got there', () => {
    const newest = row({ sentAt: at('50'), body: 'Something else' });
    const baseline = captureBaseline({ read: true, items: [newest] });
    expect(candidatesFor(pending(baseline), [row({ sentAt: at('10') })])).toEqual([]);
  });

  it('only the Buyer row counts: a Seller, a team member or an automated row with the same text does not', () => {
    const baseline = { newestSentAt: at('01'), edgeIds: [] };
    const rows = (['SELLER', 'TEAM_MEMBER', 'BOT'] as const).map((kind) => row({ kind, sentAt: at('30') }));
    expect(candidatesFor(pending(baseline), rows)).toEqual([]);
  });

  it('the text must be exactly the one sent: case, a trailing space, another Unicode form and a prefix do not match', () => {
    const baseline = { newestSentAt: at('01'), edgeIds: [] };
    const wrong = ['is this still available?', 'Is this still available? ', 'Is this still', 'Is this still available?!'];
    expect(candidatesFor(pending(baseline), wrong.map((body) => row({ body, sentAt: at('30') })))).toEqual([]);
    // The same letters composed and decomposed are different strings, so they are not the same message.
    expect(candidatesFor(pending(baseline, { text: 'caf\u00e9' }), [row({ body: 'cafe\u0301', sentAt: at('30') })])).toEqual([]);
    expect(candidatesFor(pending(baseline, { text: 'caf\u00e9' }), [row({ body: 'caf\u00e9', sentAt: at('30') })])).toHaveLength(1);
  });

  it('an anchored send matches only rows about a Product, and a plain one only plain rows', () => {
    const baseline = { newestSentAt: at('01'), edgeIds: [] };
    const plain = row({ sentAt: at('30') });
    const anchored = row({ sentAt: at('31'), aboutProduct: true });
    expect(candidatesFor(pending(baseline, { aboutProduct: true }), [anchored, plain])).toEqual([anchored]);
    expect(candidatesFor(pending(baseline, { aboutProduct: false }), [anchored, plain])).toEqual([plain]);
  });

  it('two candidates are both returned, in the order the history gave them', () => {
    const baseline = { newestSentAt: at('01'), edgeIds: [] };
    const first = row({ sentAt: at('40') });
    const second = row({ sentAt: at('30') });
    expect(candidatesFor(pending(baseline), [first, second])).toEqual([first, second]);
  });

  it('reads no clock: the same answer whatever the device time is', () => {
    jest.useFakeTimers();
    try {
      const earlier = row({ sentAt: at('10') });
      const newer = row({ sentAt: at('40') });
      const baseline = captureBaseline({ read: true, items: [earlier] });
      for (const now of ['1970-01-02T00:00:00Z', '2026-11-18T10:00:30Z', '2100-01-01T00:00:00Z']) {
        jest.setSystemTime(new Date(now));
        expect(candidatesFor(pending(baseline), [newer, earlier])).toEqual([newer]);
      }
    } finally {
      jest.useRealTimers();
    }
  });

  it('matches a message at the length limit written in Ge\'ez, which is three bytes a letter', () => {
    const long = '\u1200'.repeat(4000);
    const baseline = { newestSentAt: at('01'), edgeIds: [] };
    expect(candidatesFor(pending(baseline, { text: long }), [row({ body: long, sentAt: at('30') })])).toHaveLength(1);
    expect(candidatesFor(pending(baseline, { text: long }), [row({ body: long.slice(1), sentAt: at('30') })])).toEqual([]);
  });

  it('does not change the rows it is given', () => {
    const rows = Object.freeze([Object.freeze(row({ sentAt: at('40') })), Object.freeze(row({ sentAt: at('30') }))]);
    const baseline = Object.freeze({ newestSentAt: at('01'), edgeIds: Object.freeze([]) });
    expect(() => candidatesFor(pending(baseline), rows)).not.toThrow();
    expect(() => captureBaseline({ read: true, items: rows })).not.toThrow();
  });
});
