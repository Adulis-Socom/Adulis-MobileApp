/**
 * Reads one catalogue object (the `export const <exportName> = { ... }` of a src file) with
 * TypeScript's own parser, so single-quoted, double-quoted and template values and escapes such
 * as a unicode escape sequence are all read as the code reads them. A value that is not a plain string (a literal, a
 * template without substitutions, or literals joined with +) is a PROBLEM, never skipped.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** @returns {{ values: Map<string, string>, problems: string[] }} */
export function readCatalogue(file, exportName) {
  const problems = [];
  const sourceFile = ts.createSourceFile(file, readFileSync(path.join(src, file), 'utf8'), ts.ScriptTarget.Latest, true);
  const text = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isParenthesizedExpression(node)) return text(node.expression);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = text(node.left);
      const right = text(node.right);
      return left === null || right === null ? null : left + right;
    }
    return null;
  };
  const values = new Map();
  let found = false;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText() === exportName && node.initializer) {
      found = true;
      const literal = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (!ts.isObjectLiteralExpression(literal)) problems.push(`${exportName} is not an object literal`);
      else {
        for (const member of literal.properties) {
          const key = ts.isPropertyAssignment(member) ? member.name.getText().replace(/^['"]|['"]$/g, '') : member.getText();
          const value = ts.isPropertyAssignment(member) ? text(member.initializer) : null;
          if (value === null) problems.push(`${key}: the value is not a plain string, so it cannot be checked`);
          else if (values.has(key)) problems.push(`${key}: the key is written twice`);
          else values.set(key, value);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!found) problems.push(`${file}: no ${exportName} declaration was found`);
  return { values, problems };
}
