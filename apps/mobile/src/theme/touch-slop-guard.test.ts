import { uiSources } from '../testing/source-scan';

/**
 * BUY-04C (G04-6, the part that finds a real regression): `hitSlop` widens what a finger can hit around a control, so it
 * is a touch-target size. It comes from the spacing scale (`theme.space.*`), never a bare number, the same rule the
 * numeric-layout guard applies to padding and sizes. (maxLength is a text limit, not a layout size, and the icon-scale
 * arithmetic in CardSaveButton is an expression of the system font scale: neither is something this rule can judge.)
 */
const HIT_SLOP = /hitSlop=\{\s*((?:[^{}]|\{[^{}]*\})*?)\s*\}/g;
const bare = (text: string) => [...text.matchAll(HIT_SLOP)].map((m) => m[1] ?? '').filter((value) => !/^theme\.space\.\w+$/.test(value));

describe('touch slop', () => {
  it('is always a spacing token', () => {
    const offenders = uiSources().flatMap(({ file, text }) =>
      bare(text).map((value) => `${file} :: hitSlop=${value}`),
    );
    expect(offenders).toEqual([]);
  });

  it('the rule itself sees a bare number, an expression and an object, and lets a token through', () => {
    expect(bare('<Pressable hitSlop={8} />')).toEqual(['8']);
    expect(bare('<Pressable hitSlop={{ top: 8, bottom: 8 }} />')).toEqual(['{ top: 8, bottom: 8 }']);
    expect(bare('<Pressable hitSlop={theme.space.xs * 2} />')).toEqual(['theme.space.xs * 2']);
    expect(bare('<Pressable hitSlop={theme.space.xs} />')).toEqual([]);
    expect(bare('<Pressable hitSlop={\n  theme.space.sm\n} />')).toEqual([]);
  });
});
