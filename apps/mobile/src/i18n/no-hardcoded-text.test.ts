import ts from 'typescript';

import { productionSources } from '../testing/source-scan';

/**
 * No sentence is written into a component. Every word a person reads, hears or types against comes
 * from the catalogue, so Amharic and English stay one switch apart and a missing string is a build
 * failure, never English shown in place of Amharic. The scan reads each production file with
 * TypeScript's parser and reports four things:
 *
 * - JSX text that holds a letter;
 * - a literal given to a text prop (`label`, `title`, `placeholder`, `hint`, `headerTitle`,
 *   `tabBarLabel`, `accessibilityLabel`, `accessibilityHint`), as a JSX attribute or an object property;
 * - a literal sentence inside `Alert.alert(...)`, `announceForAccessibility(...)` or `setError(...)`
 *   (two or more words, or one capitalised word);
 * - a template with literal sentences in the same places.
 *
 * A catalogue key written out as a string (`message="buyer.seller.gone"`), a bare option word
 * (`style: 'cancel'`), an error code (`'NOT_FOUND'`) and a route (`'/account'`) are not text. What is
 * left is listed below with its reason; the list is exact, so a new literal, or an entry that no longer
 * matches, fails here.
 */

const SCANNED = ['buyer', 'components', 'app', 'modes', 'auth'];

/** Whole files that exist for developers only: never rendered in a release build. */
const DEVELOPMENT_ONLY: readonly (readonly [file: string, why: string])[] = [
  ['app/dev/index.tsx', 'the developer diagnostics screen: the route redirects to Buyer Home outside development builds'],
  ['modes/ModeShell.tsx', 'the Courier diagnostic shell: the Courier mode exists only in development builds'],
];

/** One literal at a time, `file :: text`, with the reason it is allowed. */
const ALLOWED: readonly (readonly [file: string, text: string, why: string])[] = [
  ['app/(buyer)/(tabs)/account.tsx', 'Developer diagnostics', 'a button drawn only when __DEV__ is true'],
];

const TEXT_PROPS = new Set([
  'label',
  'title',
  'placeholder',
  'hint',
  'headerTitle',
  'tabBarLabel',
  'tabBarAccessibilityLabel',
  'accessibilityLabel',
  'accessibilityHint',
]);
const SPOKEN_CALL = /(^|\.)(Alert\.alert|announceForAccessibility|setError)$/;
const KEY_SHAPED = /^[a-z][a-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const TWO_WORDS = /[A-Za-z]{2,}\s+[A-Za-z]/;
const CAPITALISED_WORD = /^[A-Z][a-z]+[.!?]?$/;
const isSentence = (value: string) => !KEY_SHAPED.test(value.trim()) && (TWO_WORDS.test(value) || CAPITALISED_WORD.test(value.trim()));
const hasLetters = (value: string) => /[A-Za-z]/.test(value);
const isText = (value: string) => hasLetters(value) && !KEY_SHAPED.test(value.trim());

const nameOf = (name: ts.Node) => (ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : name.getText());

function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join('');
  if (ts.isParenthesizedExpression(node)) return literalText(node.expression);
  return null;
}

/** Every text literal in one source file, as `file :: text`. */
export function textLiterals(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const found = new Set<string>();
  const add = (value: string) => found.add(`${file} :: ${value.trim().replace(/\s+/g, ' ')}`);

  const spoken = (node: ts.Node) => {
    let value: string | null = null;
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      value = node.text;
    }
    if (value !== null && isSentence(value)) add(value);
    ts.forEachChild(node, spoken);
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      if (hasLetters(node.text)) add(node.text);
    } else if (ts.isJsxAttribute(node) && TEXT_PROPS.has(nameOf(node.name)) && node.initializer) {
      const init = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      const value = init ? literalText(init) : null;
      if (value !== null && isText(value)) add(value);
    } else if (ts.isPropertyAssignment(node) && TEXT_PROPS.has(nameOf(node.name))) {
      const value = literalText(node.initializer);
      if (value !== null && isText(value)) add(value);
    } else if (ts.isCallExpression(node) && SPOKEN_CALL.test(node.expression.getText())) {
      node.arguments.forEach(spoken);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...found];
}

describe('the scan itself', () => {
  it('reports each form of written-in text it exists to catch', () => {
    const catches: [string, string][] = [
      ['<AppText>Hello there</AppText>', 'Hello there'],
      ['<Button label="Save" />', 'Save'],
      ["<Button label={'Save'} />", 'Save'],
      ['<Pressable accessibilityLabel={`Open ${name}`} />', 'Open'],
      ["const o = { title: 'Settings' };", 'Settings'],
      ["Alert.alert('Delete?', 'This cannot be undone', [{ text: 'Go on' }]);", 'This cannot be undone'],
      ["AccessibilityInfo.announceForAccessibility('Saved');", 'Saved'],
      ["setError('Try again');", 'Try again'],
    ];
    for (const [source, text] of catches) expect({ source, found: textLiterals('sample.tsx', source) }).toEqual({ source, found: expect.arrayContaining([`sample.tsx :: ${text}`]) });
  });

  it('passes catalogue keys, calls, style options and non-text', () => {
    const clean = [
      "<AppText>{t('buyer.x.y')}</AppText>",
      '<GoneState message="buyer.seller.gone" />',
      "<Button label={t('buyer.x.y')} />",
      "Alert.alert(t('a.b'), t('c.d'), [{ text: t('e.f'), style: 'cancel' }, { text: t('g.h'), style: 'destructive' }]);",
      '<View style={{ flex: 1 }} testID="save-controls" />',
      "<AppText>{' '}</AppText>",
      '<Ionicons name="close" size={12} />',
      '<AppText>*</AppText>',
      "AccessibilityInfo.announceForAccessibility(t('buyer.delete.checking'));",
      'setError(null);',
      "setError(code === 'VALIDATION_FAILED' ? t('a.b') : failureMessage(t, e));",
      "Alert.alert(t('a.b'), t('c.d'), [{ text: t('e.f'), onPress: () => go('/account') }]);",
    ];
    for (const source of clean) expect({ source, found: textLiterals('sample.tsx', source) }).toEqual({ source, found: [] });
  });
});

describe('production sources', () => {
  const sources = productionSources(...SCANNED);
  const found = sources.flatMap(({ file, text }) => textLiterals(file, text));
  const developmentOnly = new Set(DEVELOPMENT_ONLY.map(([file]) => file));

  it('reads the Buyer UI', () => {
    expect(sources.length).toBeGreaterThan(60);
    expect(sources.some(({ file }) => file === 'buyer/Conversation.tsx')).toBe(true);
    expect(sources.some(({ file }) => file === 'app/(buyer)/(tabs)/account.tsx')).toBe(true);
  });

  it('has no text written into a component, apart from the listed development-only code', () => {
    const outside = found.filter((entry) => !developmentOnly.has(entry.split(' :: ')[0] ?? ''));
    expect(outside.sort()).toEqual(ALLOWED.map(([file, text]) => `${file} :: ${text}`).sort());
  });

  it('lists only development-only files that still hold text, so a stale entry is noticed', () => {
    for (const [file] of DEVELOPMENT_ONLY) {
      expect({ file, literals: found.filter((entry) => entry.startsWith(`${file} :: `)).length > 0 }).toEqual({ file, literals: true });
    }
  });
});
