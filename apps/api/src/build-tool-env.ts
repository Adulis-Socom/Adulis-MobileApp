/**
 * build-tool-env.ts -- a SIDE-EFFECT module, imported first by the contract
 * generator and by nothing else.
 *
 * ADU-RUL-03 S1.2's boundary refuses an unset NODE_ENV, and app.module.ts
 * constructs its adapters at MODULE LOAD, so by the time any statement in a
 * build tool's body runs, the refusal has already fired. The declaration has
 * to happen in an import that precedes it -- which is what this file is.
 *
 * Why a build tool may declare one at all, when a service may not: the rule
 * is that a SERVICE which cannot determine its environment must not pick the
 * permissive default. A contract generator serves no request, sends no
 * message and writes one JSON file; it can determine its environment,
 * because it is a build. It declares the stricter of the two non-production
 * values -- under 'test' the fakes construct (which booting the container
 * needs) and the SMS adapter writes nothing at all, where 'development'
 * would open the dev OTP file for a process that will never send one.
 *
 * Set only if absent, so an explicit NODE_ENV always wins -- including
 * 'production', which correctly refuses to construct a fake and fails the
 * build rather than emitting a contract from a process that must not run.
 */
process.env['NODE_ENV'] = process.env['NODE_ENV'] ?? 'test';
