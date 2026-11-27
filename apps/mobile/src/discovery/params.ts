// A route parameter is untrusted input: one opaque reference of safe characters, or nothing. Anything else renders the neutral
// not-found state and is never forwarded to a request.
const REF = /^[A-Za-z0-9_-]{1,128}$/;
export const validRef = (value: unknown): string | null => (typeof value === 'string' && REF.test(value) ? value : null);
