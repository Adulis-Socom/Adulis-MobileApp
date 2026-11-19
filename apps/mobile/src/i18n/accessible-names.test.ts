import ts from 'typescript';

import { productionSources } from '../testing/source-scan';

/**
 * Every control a person can touch, and every image, has an accessible name from the catalogue or is
 * left out of the screen reader on purpose. The scan reads each production file with TypeScript's
 * parser and looks at every `Pressable`, `TextInput`, `Image`, `Switch` and `Ionicons`: it must carry an
 * `accessibilityLabel`, or be hidden from the screen reader (`accessible={false}`,
 * `importantForAccessibility="no..."`, `accessibilityElementsHidden`), or be listed below with the reason
 * its name comes from somewhere else. The list is exact: a new unnamed control, or an entry that no
 * longer matches, fails here.
 */

const SCANNED = ['buyer', 'components', 'app', 'modes', 'auth'];
const CONTROLS = new Set(['Pressable', 'TextInput', 'Image', 'Switch', 'Ionicons']);

const NAMED_BY_VISIBLE_TEXT = 'a tab or link whose visible words are its accessible name';
const ICON_IN_LABELLED = 'an icon inside a control that carries the label';
const PICTURE_BESIDE_TEXT = 'a picture inside a labelled control, or beside the text that names the same item';

/** `[file, element, how many, why it needs no label of its own]`. */
const NAMED_ELSEWHERE: readonly (readonly [file: string, element: string, count: number, why: string])[] = [
  ['app/(buyer)/(tabs)/_layout.tsx', 'Ionicons', 1, 'the tab bar icon: each tab has a tabBarAccessibilityLabel'],
  ['app/(buyer)/search.tsx', 'Pressable', 1, NAMED_BY_VISIBLE_TEXT],
  ['buyer/CardSaveButton.tsx', 'Ionicons', 3, ICON_IN_LABELLED],
  ['buyer/ProductDetail.tsx', 'Pressable', 1, NAMED_BY_VISIBLE_TEXT],
  ['buyer/SavedScreen.tsx', 'Pressable', 1, NAMED_BY_VISIBLE_TEXT],
  ['buyer/SceneCard.tsx', 'Image', 1, PICTURE_BESIDE_TEXT],
  ['buyer/SceneExplorer.tsx', 'Image', 1, PICTURE_BESIDE_TEXT],
  ['buyer/SearchResults.tsx', 'Image', 2, PICTURE_BESIDE_TEXT],
  ['buyer/SellerProfile.tsx', 'Pressable', 2, NAMED_BY_VISIBLE_TEXT],
  ['buyer/SellerProfile.tsx', 'Image', 2, PICTURE_BESIDE_TEXT],
];

const attributeNames = (attributes: ts.JsxAttributes) =>
  attributes.properties.flatMap((property) => (ts.isJsxAttribute(property) ? [property.name.getText()] : []));

function hiddenFromScreenReader(attributes: ts.JsxAttributes): boolean {
  return attributes.properties.some((property) => {
    if (!ts.isJsxAttribute(property)) return false;
    const name = property.name.getText();
    const value = property.initializer?.getText() ?? '';
    return (
      name === 'accessibilityElementsHidden' ||
      (name === 'accessible' && value === '{false}') ||
      (name === 'importantForAccessibility' && /^"no/.test(value))
    );
  });
}

/** The unnamed controls of one source file, as `file :: Element`. */
export function unnamedControls(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText();
      if (CONTROLS.has(tag)) {
        const names = attributeNames(node.attributes);
        if (!names.includes('accessibilityLabel') && !names.includes('aria-label') && !hiddenFromScreenReader(node.attributes)) found.push(`${file} :: ${tag}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

describe('the scan itself', () => {
  it('reports an unnamed control and passes a named or hidden one', () => {
    expect(unnamedControls('a.tsx', '<Pressable onPress={go}><AppText>x</AppText></Pressable>')).toEqual(['a.tsx :: Pressable']);
    expect(unnamedControls('a.tsx', '<Ionicons name="close" />')).toEqual(['a.tsx :: Ionicons']);
    expect(unnamedControls('a.tsx', '<Image source={s} />')).toEqual(['a.tsx :: Image']);
    expect(unnamedControls('a.tsx', '<TextInput value={v} />')).toEqual(['a.tsx :: TextInput']);
    const fine = [
      "<Pressable accessibilityLabel={t('a.b')} onPress={go} />",
      '<Pressable accessibilityRole="button" accessibilityLabel={label}><Ionicons name="x" importantForAccessibility="no" /></Pressable>',
      '<Ionicons name="x" accessibilityElementsHidden />',
      '<Pressable accessible={false} onPress={go} />',
      '<View accessible />',
      "<Image source={s} accessibilityLabel={t('a.b')} />",
    ];
    for (const source of fine) expect({ source, found: unnamedControls('a.tsx', source) }).toEqual({ source, found: [] });
  });
});

describe('production sources', () => {
  const sources = productionSources(...SCANNED);
  const found = sources.flatMap(({ file, text }) => unnamedControls(file, text));

  it('reads the Buyer UI', () => {
    expect(sources.length).toBeGreaterThan(60);
    expect(sources.some(({ file }) => file === 'buyer/HomeHeader.tsx')).toBe(true);
  });

  it('has no control without an accessible name, apart from the listed ones that are named by something else', () => {
    const listed = NAMED_ELSEWHERE.flatMap(([file, element, count]) => Array.from({ length: count }, () => `${file} :: ${element}`));
    expect(found.sort()).toEqual(listed.sort());
  });
});
