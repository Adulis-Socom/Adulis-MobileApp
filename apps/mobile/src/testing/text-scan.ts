import ts from 'typescript';

/**
 * Two source scans that read a file with TypeScript's parser and need no test runner: the sentences
 * written into a component (`textLiterals`) and the controls a screen reader cannot name
 * (`unnamedControls`). The guard tests (i18n/no-hardcoded-text.test.ts, i18n/accessible-names.test.ts)
 * run them over the app's sources and prove them against samples. Nothing here reads a file.
 */

/** Props whose value a person reads, hears or types against. */
export const TEXT_PROPS = new Set([
  'label',
  'title',
  'placeholder',
  'hint',
  'headerTitle',
  'tabBarLabel',
  'tabBarAccessibilityLabel',
  'accessibilityLabel',
  'accessibilityHint',
  'aria-label',
  'alt',
  'message',
  'text',
  'caption',
  'description',
  'subtitle',
]);

const SPOKEN_CALL = /(^|\.)(Alert\.alert|announceForAccessibility\w*|setError)$/;
/** A catalogue key written out as a string (`buyer.seller.gone`): not text. */
const KEY_SHAPED = /^[a-z][a-z0-9_]*(\.[A-Za-z0-9_]+)+$/;
const LETTER = /\p{L}/u;
const TWO_WORDS = /\p{L}{2,}\s+\p{L}/u;
const CAPITALISED_WORD = /^\p{Lu}\p{Ll}+[.!?]?$/u;
const hasNonLatinLetter = (value: string) =>
  [...value].some((c) => LETTER.test(c) && (c.codePointAt(0) ?? 0) > 0x24f);

/** A word or a string a person reads: a letter, and not a catalogue key. */
const isText = (value: string) => LETTER.test(value) && !KEY_SHAPED.test(value.trim());
/** Inside a call that speaks: a sentence (two words, one capitalised word, or any non-Latin word), not a code, a route or an option word. */
const isSentence = (value: string) =>
  !KEY_SHAPED.test(value.trim()) &&
  (TWO_WORDS.test(value) || CAPITALISED_WORD.test(value.trim()) || hasNonLatinLetter(value));

const nameOf = (name: ts.Node) =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : name.getText();

type Consts = Map<string, ts.Node[]>;

/** Every `const name = <initialiser>` in the file (any scope): a name used as a child can be read back to its literal. */
function constsOf(sourceFile: ts.SourceFile): Consts {
  const consts: Consts = new Map();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      (ts.getCombinedNodeFlags(node) & ts.NodeFlags.Const) !== 0
    ) {
      consts.set(node.name.text, [...(consts.get(node.name.text) ?? []), node.initializer]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return consts;
}

const rootIdentifier = (node: ts.Node): ts.Identifier | null => {
  let current = node;
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current))
    current = current.expression;
  return ts.isIdentifier(current) ? current : null;
};

/**
 * The string literals an expression can show: through a conditional, `&&`, `||`, `??`, `+`, a template,
 * parentheses and casts, and (one level deep, in this file) a `const` name or a member of a `const` object
 * or array. A call is not opened: `t('a.b')` shows what the catalogue holds.
 */
export function literalsIn(node: ts.Node | undefined, consts: Consts, depth = 0): string[] {
  if (!node || depth > 4) return [];
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) {
    return [
      [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(''),
      ...node.templateSpans.flatMap((span) => literalsIn(span.expression, consts, depth + 1)),
    ];
  }
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isSatisfiesExpression(node)
  )
    return literalsIn(node.expression, consts, depth);
  if (ts.isConditionalExpression(node))
    return [
      ...literalsIn(node.whenTrue, consts, depth),
      ...literalsIn(node.whenFalse, consts, depth),
    ];
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken)
      return literalsIn(node.right, consts, depth);
    if (
      operator === ts.SyntaxKind.PlusToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return [...literalsIn(node.left, consts, depth), ...literalsIn(node.right, consts, depth)];
    }
    return [];
  }
  if (ts.isIdentifier(node))
    return (consts.get(node.text) ?? []).flatMap((init) => literalsIn(init, consts, depth + 1));
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const root = rootIdentifier(node);
    const inits = (root ? consts.get(root.text) : undefined) ?? [];
    return inits
      .filter((init) => ts.isObjectLiteralExpression(init) || ts.isArrayLiteralExpression(init))
      .flatMap((init) => membersOf(init, consts, depth + 1));
  }
  return [];
}

function membersOf(node: ts.Node, consts: Consts, depth: number): string[] {
  if (ts.isObjectLiteralExpression(node))
    return node.properties.flatMap((p) =>
      ts.isPropertyAssignment(p)
        ? literalsIn(p.initializer, consts, depth).concat(membersOf(p.initializer, consts, depth))
        : [],
    );
  if (ts.isArrayLiteralExpression(node))
    return node.elements.flatMap((e) =>
      literalsIn(e, consts, depth).concat(membersOf(e, consts, depth)),
    );
  return [];
}

/** Every text written into a component in one source file, as `file :: text` (see the guard test for the forms). */
export function textLiterals(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const consts = constsOf(sourceFile);
  const found = new Set<string>();
  const add = (value: string) => found.add(`${file} :: ${value.trim().replace(/\s+/g, ' ')}`);
  const addTexts = (values: string[]) => values.filter(isText).forEach(add);

  /** Inside a call that speaks: every literal sentence among the arguments, and the literals behind a const name. */
  const spoken = (node: ts.Node) => {
    const values: string[] = [];
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    )
      values.push(node.text);
    if (ts.isIdentifier(node)) values.push(...literalsIn(node, consts));
    values.filter(isSentence).forEach(add);
    ts.forEachChild(node, spoken);
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      if (LETTER.test(node.text)) add(node.text);
    } else if (
      ts.isJsxExpression(node) &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      addTexts(literalsIn(node.expression, consts));
    } else if (ts.isJsxAttribute(node) && TEXT_PROPS.has(nameOf(node.name)) && node.initializer) {
      const init = ts.isJsxExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer;
      addTexts(literalsIn(init, consts));
    } else if (ts.isPropertyAssignment(node) && TEXT_PROPS.has(nameOf(node.name))) {
      addTexts(literalsIn(node.initializer, consts));
    } else if (ts.isShorthandPropertyAssignment(node) && TEXT_PROPS.has(node.name.text)) {
      addTexts(literalsIn(node.name, consts));
    } else if (ts.isCallExpression(node) && SPOKEN_CALL.test(node.expression.getText())) {
      node.arguments.forEach(spoken);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...found];
}

/** Touchable things a person can press, and pictures: each needs a name or must be hidden from the screen reader. */
export const CONTROLS = new Set([
  'Pressable',
  'TextInput',
  'Image',
  'Switch',
  'Ionicons',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'Link',
]);

const attributeNamed = (attributes: ts.JsxAttributes, name: string) =>
  attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === name,
  );

/** A bare attribute, or `{true}`: `accessibilityElementsHidden={false}` hides nothing. */
const isOn = (attribute: ts.JsxAttribute) =>
  attribute.initializer === undefined || attribute.initializer.getText() === '{true}';

function hiddenFromScreenReader(attributes: ts.JsxAttributes): boolean {
  const elementsHidden = attributeNamed(attributes, 'accessibilityElementsHidden');
  const ariaHidden = attributeNamed(attributes, 'aria-hidden');
  const accessible = attributeNamed(attributes, 'accessible');
  const important = attributeNamed(attributes, 'importantForAccessibility');
  return (
    (elementsHidden !== undefined && isOn(elementsHidden)) ||
    (ariaHidden !== undefined && isOn(ariaHidden)) ||
    accessible?.initializer?.getText() === '{false}' ||
    (important?.initializer !== undefined &&
      /^(\{\s*)?["']no/.test(important.initializer.getText()))
  );
}

/** A label that says something: an empty literal names nothing. */
function labelled(attributes: ts.JsxAttributes): boolean {
  return ['accessibilityLabel', 'aria-label'].some((name) => {
    const attribute = attributeNamed(attributes, name);
    if (!attribute?.initializer) return false;
    return !(ts.isStringLiteral(attribute.initializer) && attribute.initializer.text.trim() === '');
  });
}

/** The controls of one source file with no name and not hidden from the screen reader, as `file :: Element`. */
export function unnamedControls(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText();
      if (
        CONTROLS.has(tag) &&
        !labelled(node.attributes) &&
        !hiddenFromScreenReader(node.attributes)
      )
        found.push(`${file} :: ${tag}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}
