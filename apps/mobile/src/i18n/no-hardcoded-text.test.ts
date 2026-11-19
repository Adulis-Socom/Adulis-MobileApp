import { textLiterals } from '../testing/text-scan';
import { NON_UI_DIRS, productionSources, uiSources } from '../testing/source-scan';

/**
 * No sentence is written into a component. Every word a person reads, hears or types against comes
 * from the catalogue, so Amharic and English stay one switch apart and a missing string is a build
 * failure, never English shown in place of Amharic.
 *
 * WHAT IS READ. Every production source under `src` except the folders in NON_UI_DIRS (fixtures, tokens,
 * the API client, device and storage plumbing, state, catalogue plumbing), so the Seller Companion
 * (`seller/`), `providers/` and any folder added later are read by default.
 *
 * WHAT IS REPORTED (testing/text-scan.ts reads each file with TypeScript's parser):
 * - JSX text with a letter of any script (Latin, Ethiopic, accented);
 * - a string, template, conditional (`a ? 'x' : 'y'`), `&&`, `||`, `??` or `+` expression written as a JSX
 *   child, and a `const` name or `const` object member (declared in the same file) used as one;
 * - the same forms given to a text prop (label, title, placeholder, hint, headerTitle, tabBarLabel,
 *   accessibilityLabel, accessibilityHint, aria-label, alt, message, text, caption, description, subtitle),
 *   as a JSX attribute or an object property (a shorthand property too);
 * - a literal sentence (two words, one capitalised word, or any non-Latin word) inside
 *   `Alert.alert(...)`, `announceForAccessibility(...)` or `setError(...)`, and a `const` name used there.
 * A catalogue key written out as a string (`message="buyer.seller.gone"`), a bare option word
 * (`style: 'cancel'`), an error code (`'NOT_FOUND'`) and a route (`'/account'`) are not text.
 *
 * WHAT IT CANNOT SEE. A name or member imported from another file (read it there: it is a file of `src`),
 * a function parameter or `let`, text built by a function call other than through the catalogue, and text
 * in a file outside `src`. It is a scan, not a proof.
 *
 * WHAT IS LEFT. The development-only code below, one literal at a time with the reason, and the facts that
 * make it development-only, checked from the sources. The lists are exact: a new literal, or an entry that no
 * longer matches, fails here.
 */

/** `file -> [why, literals]`: text that exists for developers only and is never drawn by a release build. */
const DEVELOPMENT_ONLY_TEXT: Record<string, { why: string; texts: string[] }> = {
  'app/dev/index.tsx': {
    why: 'the developer diagnostics screen: its route redirects to Buyer Home outside development builds',
    texts: [
      'API origin:',
      'Amharic',
      'Dark',
      'Developer diagnostics',
      'Development builds only. Not product UI.',
      'English',
      'Language (Amharic QA, development builds only)',
      'Light',
      'Network:',
      'Open',
      'SQLite:',
      'Seller Companion and Courier are unlocked here for foundation diagnostics only. Real eligibility comes from the backend (account_context), and release builds offer Buyer only.',
      'Session:',
      'System',
      'Theme',
      'account_context:',
      'available',
      'none',
      'offline',
      'online',
      'seller_companion , courier',
      'signed in',
      'signed out',
      'unavailable',
    ],
  },
  'modes/ModeShell.tsx': {
    why: 'the Courier diagnostic shell: the Courier mode is offered only in development builds',
    texts: [
      'Active mode:',
      'Back to diagnostics',
      'Diagnostic shell. No',
      'Session:',
      'Switch to',
      'features are built yet.',
      'foundation ready',
      'none',
      'signed in',
      'signed out',
    ],
  },
  'app/(buyer)/(tabs)/account.tsx': {
    why: 'a button drawn only when __DEV__ is true',
    texts: ['Developer diagnostics'],
  },
};

const chars = (...codePoints: number[]) => String.fromCodePoint(...codePoints);
const AMHARIC = chars(0x1230, 0x120b, 0x121d);
const ACCENTED = `Caf${chars(0xe9)}`;
const CHECK_MARK = chars(0x2713);

const found = (source: string) => textLiterals('sample.tsx', source);

describe('the scan itself', () => {
  it.each([
    // JSX children
    ['JSX text', '<AppText>Hello there</AppText>', 'Hello there'],
    ['a string expression', "<AppText>{'Hello there'}</AppText>", 'Hello there'],
    ['a template', '<AppText>{`Hello ${name}`}</AppText>', 'Hello'],
    ['a conditional', "<AppText>{ok ? 'Yes please' : 'No thanks'}</AppText>", 'No thanks'],
    [
      'a conditional (first branch)',
      "<AppText>{ok ? 'Yes please' : t('a.b')}</AppText>",
      'Yes please',
    ],
    ['&&', "<AppText>{ok && 'Saved it'}</AppText>", 'Saved it'],
    ['||', "<AppText>{count || 'Nothing here'}</AppText>", 'Nothing here'],
    ['??', "<AppText>{name ?? 'Nobody yet'}</AppText>", 'Nobody yet'],
    ['concatenation (each part)', "<AppText>{'Hello' + ' world'}</AppText>", 'world'],
    [
      'a const name',
      "const s = 'Save the changes'; const A = () => <AppText>{s}</AppText>;",
      'Save the changes',
    ],
    [
      'a const object member',
      "const COPY = { a: 'Save it' }; const A = () => <AppText>{COPY.a}</AppText>;",
      'Save it',
    ],
    [
      'a const array member',
      "const WORDS = ['Save it', 'Drop it']; const A = () => <AppText>{WORDS[0]}</AppText>;",
      'Drop it',
    ],
    ['a fragment child', "<>{'Hello there'}</>", 'Hello there'],
    // text props
    ['a literal label', '<Button label="Save" />', 'Save'],
    ['a string-expression label', "<Button label={'Save'} />", 'Save'],
    ['a conditional label', "<Button label={ok ? 'Save now' : 'Cancel now'} />", 'Cancel now'],
    ['a template accessibilityLabel', '<Pressable accessibilityLabel={`Open ${name}`} />', 'Open'],
    ['aria-label', '<View aria-label="Close dialog" />', 'Close dialog'],
    ['alt', '<Image alt="A picture" />', 'A picture'],
    ['message', '<Placeholder message="Nothing here yet" />', 'Nothing here yet'],
    ['a title property', "const o = { title: 'Settings' };", 'Settings'],
    [
      'a conditional headerTitle',
      "const o = { options: { headerTitle: ok ? 'One two' : 'Three four' } };",
      'Three four',
    ],
    [
      'a shorthand property',
      "const title = 'Settings page'; const o = { title };",
      'Settings page',
    ],
    ['Share message', "Share.share({ message: 'Hello world' });", 'Hello world'],
    ['a text property', "const b = { text: 'Go on then' };", 'Go on then'],
    // spoken calls
    [
      'Alert.alert',
      "Alert.alert('Delete?', 'This cannot be undone', [{ text: 'Go on' }]);",
      'This cannot be undone',
    ],
    [
      'Alert.alert with a const',
      "const m = 'Delete this now'; Alert.alert(t('a.b'), m);",
      'Delete this now',
    ],
    ['announceForAccessibility', "AccessibilityInfo.announceForAccessibility('Saved');", 'Saved'],
    ['setError', "setError('Try again');", 'Try again'],
    // other scripts
    ['Ethiopic JSX text', `<AppText>${AMHARIC}</AppText>`, AMHARIC],
    ['Ethiopic in a label', `<Button label="${AMHARIC}" />`, AMHARIC],
    ['Ethiopic in an expression', `<AppText>{ok ? '${AMHARIC}' : t('a.b')}</AppText>`, AMHARIC],
    ['one Ethiopic word in setError', `setError('${AMHARIC}');`, AMHARIC],
    ['an accented word', `<AppText>${ACCENTED}</AppText>`, ACCENTED],
  ])('reports %s', (_form, source, text) => {
    expect(found(source)).toContain(`sample.tsx :: ${text}`);
  });

  it.each([
    ['a catalogue call', "<AppText>{t('buyer.x.y')}</AppText>"],
    ['a conditional of catalogue calls', "<AppText>{ok ? t('a.b') : t('c.d')}</AppText>"],
    ['a key written out', '<GoneState message="buyer.seller.gone" />'],
    ['a label from the catalogue', "<Button label={t('a.b')} />"],
    ['a conditional label from the catalogue', "<Button label={ok ? t('a.b') : t('c.d')} />"],
    ['a space', "<AppText>{' '}</AppText>"],
    ['a separator', "<AppText>{'/'}</AppText>"],
    ['a handle template', '<AppText>{`@${handle}`}</AppText>'],
    ['a number', '<AppText>{String(count)}</AppText>'],
    [
      'a mark with no letter',
      `const checkMark = '${CHECK_MARK}'; const A = () => <AppText>{checkMark}</AppText>;`,
    ],
    ['an element', '<AppText>{ok && <Ionicons name="x" />}</AppText>'],
    ['an icon name', '<Ionicons name="search-outline" size={12} />'],
    [
      'layout props',
      '<View style={{ flex: 1 }} testID="save-controls" accessibilityRole="button" />',
    ],
    [
      'a key held in a const and passed to t',
      "const key = 'buyer.x.y'; const A = () => <AppText>{t(key)}</AppText>;",
    ],
    ['a function parameter', 'function F({ label }) { return <AppText>{label}</AppText>; }'],
    [
      'Alert with catalogue calls',
      "Alert.alert(t('a.b'), t('c.d'), [{ text: t('e.f'), style: 'cancel' }, { text: t('g.h'), style: 'destructive' }]);",
    ],
    ['an error code', "setError(code === 'VALIDATION_FAILED' ? t('a.b') : failureMessage(t, e));"],
    ['a code held in a const', "const CODE = 'NOT_FOUND'; setError(CODE);"],
    [
      'a route in a callback',
      "Alert.alert(t('a.b'), t('c.d'), [{ text: t('e.f'), onPress: () => go('/account') }]);",
    ],
    [
      'an announcement from the catalogue',
      "AccessibilityInfo.announceForAccessibility(t('buyer.delete.checking'));",
    ],
    ['a null error', 'setError(null);'],
  ])('passes %s', (_form, source) => {
    expect(found(source)).toEqual([]);
  });
});

describe('what is read', () => {
  const sources = uiSources();

  it('is every production source outside the non-UI folders, the Seller Companion and providers included', () => {
    expect(sources.length).toBeGreaterThan(90);
    for (const name of [
      'buyer/Conversation.tsx',
      'seller/SellerHome.tsx',
      'seller/SellerMessages.tsx',
      'providers/AppProviders.tsx',
      'app/(buyer)/(tabs)/account.tsx',
      'components/Button.tsx',
    ]) {
      expect({ name, read: sources.some(({ file }) => file === name) }).toEqual({
        name,
        read: true,
      });
    }
    expect(sources.filter(({ file }) => NON_UI_DIRS.includes(file.split('/')[0] ?? ''))).toEqual(
      [],
    );
  });

  it('leaves out only folders that draw nothing, and every folder of src is one or the other', () => {
    const folders = new Set(
      productionSources('.')
        .map(({ file }) => file.split('/')[0] ?? '')
        .filter((name) => !name.includes('.')),
    );
    const read = new Set(sources.map(({ file }) => file.split('/')[0] ?? ''));
    for (const folder of folders)
      expect({ folder, accounted: read.has(folder) || NON_UI_DIRS.includes(folder) }).toEqual({
        folder,
        accounted: true,
      });
  });
});

describe('production sources', () => {
  const sources = uiSources();
  const all = sources.flatMap(({ file, text }) => textLiterals(file, text));
  const listed = Object.entries(DEVELOPMENT_ONLY_TEXT).flatMap(([file, { texts }]) =>
    texts.map((text) => `${file} :: ${text}`),
  );

  it('has no text written into a component, apart from the listed development-only text', () => {
    expect([...all].sort()).toEqual([...listed].sort());
  });

  it('lists nothing that is no longer there (the list above is exact in both directions)', () => {
    for (const [file, { why }] of Object.entries(DEVELOPMENT_ONLY_TEXT)) {
      expect({
        file,
        why: why.length > 0,
        literals: all.filter((entry) => entry.startsWith(`${file} :: `)).length > 0,
      }).toEqual({ file, why: true, literals: true });
    }
  });

  const sourceText = (name: string) => sources.find(({ file }) => file === name)?.text ?? '';

  it('keeps the development-only text development-only: the facts it rests on, read from the sources', () => {
    // The diagnostics route redirects to Buyer Home outside development builds.
    expect(sourceText('app/dev/_layout.tsx')).toMatch(/__DEV__\s*\?\s*<Slot\s*\/>\s*:\s*<Redirect/);
    // The one button that opens it is drawn only when __DEV__ is true.
    expect(sourceText('app/(buyer)/(tabs)/account.tsx')).toMatch(
      /__DEV__\s*\?\s*<Button label="Developer diagnostics"/,
    );
    // The Courier shell is offered only with the development diagnostics flag, and drawn only by the Courier route.
    expect(sourceText('modes/modes.ts')).toMatch(/if \(devDiagnostics\) modes\.push\('courier'\)/);
    expect(
      sources
        .filter(({ text: body }) =>
          /from '[./]+\/modes\/ModeShell'|from '\.\/ModeShell'/.test(body),
        )
        .map(({ file }) => file),
    ).toEqual(['app/courier/index.tsx']);
    // The English mode names are used only by the development screens.
    expect(
      sources
        .filter(({ text: body }) => body.includes('MODE_LABEL'))
        .map(({ file }) => file)
        .sort(),
    ).toEqual(['app/dev/index.tsx', 'modes/ModeShell.tsx', 'modes/modes.ts']);
  });
});
