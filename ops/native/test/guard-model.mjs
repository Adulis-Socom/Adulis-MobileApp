// A model of what PostgreSQL does with the identity guard in a fixture script, evaluated from the
// SQL TEXT the harness actually sends (so a changed connective, a negated predicate, a missing
// RAISE or a guard that is not first changes the result). It understands exactly the guard's shape
// and throws on anything else: a reworded guard fails the tests until this model is updated on
// purpose. The real statement is executed against a disposable PostgreSQL by guard-live.test.mjs.
//
// What the model covers: the connective (OR, AND precedence), each IS [NOT] DISTINCT FROM, the compared
// constants, the RAISE and that the guard is the script's first statement. What it does NOT cover is how
// PostgreSQL evaluates the inner SELECT of the run-setting term (the pg_db_role_setting predicates, the
// substr offset): that text is PINNED byte for byte in guard.test.mjs, and its behaviour is proven only
// by the opt-in live test and by a live run.

const FIRST_STATEMENT = /^\s*(?:--[^\n]*\n\s*)*DO\s+\$guard\$([\s\S]*?)\$guard\$\s*;/;

/** Splits on a top-level keyword (outside parentheses and quotes), case-sensitive on the text. */
function splitTop(text, word) {
  const parts = [];
  let depth = 0;
  let quote = false;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === "'") quote = !quote;
    else if (!quote && c === '(') depth += 1;
    else if (!quote && c === ')') depth -= 1;
    else if (!quote && depth === 0 && text.startsWith(` ${word} `, i)) {
      parts.push(text.slice(start, i));
      start = i + word.length + 2;
      i = start - 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/** The value one side of a comparison reads from a server whose identity is `facts`. */
function valueOf(expr, facts) {
  const e = expr.replace(/\s+/g, ' ').trim();
  if (/^\(?SELECT system_identifier::text FROM pg_control_system\(\)\)?$/.test(e))
    return facts.systemId;
  if (e === 'current_database()') return facts.db;
  if (
    /^coalesce\(\(SELECT substr\(s, .*FROM pg_db_role_setting r, unnest\(r\.setconfig\) s .*native_run=.*\), ''\)$/.test(
      e,
    )
  )
    return facts.setting ?? '';
  throw new Error(`the guard compares an expression the model does not know: ${e}`);
}

/**
 * Evaluates the script's FIRST statement (it must be the guard). Returns { guarded, raises }.
 * `guarded` is false when the script does not start with the guard (an unguarded script runs as is).
 */
export function evaluateGuard(sql, facts) {
  const m = FIRST_STATEMENT.exec(sql);
  if (!m) return { guarded: false, raises: false };
  const body = m[1].replace(/\s+/g, ' ').trim();
  const ifm = /^BEGIN IF (.*) THEN RAISE EXCEPTION '([^']*)'; END IF; END$/.exec(body);
  if (!ifm) throw new Error(`the guard block has a shape the model does not know: ${body}`);
  const term = (t) => {
    const x = /^(.*) IS (NOT )?DISTINCT FROM '([^']*)'$/.exec(t.trim());
    if (!x) throw new Error(`the guard has a term the model does not know: ${t}`);
    const differs = valueOf(x[1], facts) !== x[3];
    return x[2] ? !differs : differs;
  };
  // AND binds tighter than OR, as in SQL.
  const raises = splitTop(ifm[1], 'OR').some((d) => splitTop(d, 'AND').every(term));
  return { guarded: true, raises, message: ifm[2] };
}
