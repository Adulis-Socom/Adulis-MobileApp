import { unnamedControls } from '../testing/text-scan';
import { uiSources } from '../testing/source-scan';

/**
 * Every control a person can touch, and every image, has an accessible name from the catalogue or is
 * left out of the screen reader on purpose. The scan (testing/text-scan.ts) reads each production source
 * under `src` outside the non-UI folders, the Seller Companion included, with TypeScript's parser and
 * looks at every `Pressable`, `TextInput`, `Image`, `Switch`, `Ionicons`, `TouchableOpacity`,
 * `TouchableHighlight`, `TouchableWithoutFeedback`, `TouchableNativeFeedback` and `Link`. Each must
 *
 * - carry an `accessibilityLabel` or `aria-label` that is not an empty literal, or
 * - be hidden from the screen reader: `accessible={false}`, `importantForAccessibility="no..."`, or
 *   `accessibilityElementsHidden` / `aria-hidden` bare or `{true}` (`{false}` hides nothing), or
 * - be listed below with the reason its name comes from somewhere else.
 *
 * The list is exact and counted per file and element: a new unnamed control, or an entry that no longer
 * matches, fails here. What it cannot see: a `{...props}` spread (read as no label: write the label
 * explicitly), a label passed to a wrapper component (the wrappers, `Button`, `Checkbox`, `TextField` and
 * `ChoiceGroup`, take a required label), and a control drawn by the navigator itself (the tab bar: each tab
 * names itself with `tabBarAccessibilityLabel`). accessible-names-rendered.test.tsx asks the same question
 * of a few screens as they are drawn.
 */

const NAMED_BY_VISIBLE_TEXT = 'a tab or link whose visible words are its accessible name';
const ICON_IN_LABELLED = 'an icon inside a control that carries the label';
const PICTURE_BESIDE_TEXT =
  'a picture inside a labelled control, or beside the text that names the same item';

/** `[file, element, how many, why it needs no label of its own]`. */
const NAMED_ELSEWHERE: readonly (readonly [
  file: string,
  element: string,
  count: number,
  why: string,
])[] = [
  [
    'app/(buyer)/(tabs)/_layout.tsx',
    'Ionicons',
    1,
    'the tab bar icon: each tab has a tabBarAccessibilityLabel',
  ],
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

const found = (source: string) => unnamedControls('a.tsx', source);

describe('the scan itself', () => {
  it.each([
    [
      'a Pressable with only words inside',
      '<Pressable onPress={go}><AppText>x</AppText></Pressable>',
      'Pressable',
    ],
    ['an icon', '<Ionicons name="close" />', 'Ionicons'],
    ['an image', '<Image source={s} />', 'Image'],
    ['a text input', '<TextInput value={v} />', 'TextInput'],
    ['a switch', '<Switch value={v} />', 'Switch'],
    [
      'a TouchableOpacity',
      '<TouchableOpacity onPress={go}><Ionicons name="x" accessibilityElementsHidden /></TouchableOpacity>',
      'TouchableOpacity',
    ],
    ['a TouchableHighlight', '<TouchableHighlight onPress={go} />', 'TouchableHighlight'],
    [
      'a TouchableWithoutFeedback',
      '<TouchableWithoutFeedback onPress={go} />',
      'TouchableWithoutFeedback',
    ],
    [
      'a TouchableNativeFeedback',
      '<TouchableNativeFeedback onPress={go} />',
      'TouchableNativeFeedback',
    ],
    ['a Link', '<Link href="/x"><Ionicons name="x" accessibilityElementsHidden /></Link>', 'Link'],
    [
      'accessibilityElementsHidden={false}',
      '<Pressable accessibilityElementsHidden={false} onPress={go} />',
      'Pressable',
    ],
    ['aria-hidden={false}', '<Ionicons name="x" aria-hidden={false} />', 'Ionicons'],
    [
      'importantForAccessibility="yes"',
      '<Ionicons name="x" importantForAccessibility="yes" />',
      'Ionicons',
    ],
    [
      'an empty accessibilityLabel',
      '<Pressable accessibilityLabel="" onPress={go} />',
      'Pressable',
    ],
    ['a blank aria-label', '<Pressable aria-label="  " onPress={go} />', 'Pressable'],
  ])('reports %s', (_form, source, element) => {
    expect(found(source)).toContain(`a.tsx :: ${element}`);
  });

  it.each([
    ['an accessibilityLabel', "<Pressable accessibilityLabel={t('a.b')} onPress={go} />"],
    ['an aria-label', "<TouchableOpacity aria-label={t('a.b')} onPress={go} />"],
    [
      'a label and a hidden icon inside',
      '<Pressable accessibilityRole="button" accessibilityLabel={label}><Ionicons name="x" importantForAccessibility="no" /></Pressable>',
    ],
    ['a bare accessibilityElementsHidden', '<Ionicons name="x" accessibilityElementsHidden />'],
    [
      'accessibilityElementsHidden={true}',
      '<Ionicons name="x" accessibilityElementsHidden={true} />',
    ],
    ['a bare aria-hidden', '<Ionicons name="x" aria-hidden />'],
    [
      'importantForAccessibility="no-hide-descendants"',
      '<Image source={s} importantForAccessibility="no-hide-descendants" />',
    ],
    ['accessible={false}', '<Pressable accessible={false} onPress={go} />'],
    ['a View', '<View accessible />'],
    ['a labelled image', "<Image source={s} accessibilityLabel={t('a.b')} />"],
    ['a labelled Link', '<Link href="/x" accessibilityLabel={t(\'a.b\')}>words</Link>'],
  ])('passes %s', (_form, source) => {
    expect(found(source)).toEqual([]);
  });
});

describe('production sources', () => {
  const sources = uiSources();
  const all = sources.flatMap(({ file, text }) => unnamedControls(file, text));

  it('reads the Buyer UI and the Seller Companion', () => {
    expect(sources.length).toBeGreaterThan(90);
    for (const name of [
      'buyer/HomeHeader.tsx',
      'seller/SellerHome.tsx',
      'seller/SellerMessages.tsx',
      'app/(buyer)/(tabs)/_layout.tsx',
    ]) {
      expect({ name, read: sources.some(({ file }) => file === name) }).toEqual({
        name,
        read: true,
      });
    }
  });

  it('has no control without an accessible name, apart from the listed ones that are named by something else', () => {
    const listed = NAMED_ELSEWHERE.flatMap(([file, element, count]) =>
      Array.from({ length: count }, () => `${file} :: ${element}`),
    );
    expect([...all].sort()).toEqual([...listed].sort());
  });
});
