/**
 * The problem item's resolving_action is an open shape with a required kind: some kinds carry further members
 * (REDUCE_QUANTITY carries `to`), and a typed client must be able to read them. Run by `test` (tsc over
 * tsconfig.test.json); a failing assertion is a type error.
 */
import type { components } from '../src/index';

type Assert<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Action = NonNullable<components['schemas']['ProblemItemDto']['resolving_action']>;

// `kind` is always present.
type _Kind = Assert<Equal<Action['kind'], string>>;
// A further member is readable (as unknown, to be narrowed by the kind that carries it).
type _Extra = Assert<Equal<Action['to'], unknown>>;

export const withExtraMember: Action = { kind: 'REDUCE_QUANTITY', to: 3 };
export const withKindOnly: Action = { kind: 'REMOVE_LINE' };
// @ts-expect-error -- kind is required
export const withoutKind: Action = { to: 3 };

// The object a problem item is about has both of its members.
type Subject = NonNullable<components['schemas']['ProblemItemDto']['subject']>;
type _Subject = Assert<Equal<keyof Subject, 'kind' | 'id'>>;
type _SubjectRequired = Assert<Equal<Subject, { kind: string; id: string }>>;
