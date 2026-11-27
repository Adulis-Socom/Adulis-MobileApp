// The closed set of route templates and their access classes (MOB-FE-01 s9, s10). Derived from the approved route tree. There is
// no Order, delivery, handoff, claim or Reservation template and no Operator template: a link to one of those is not a route.
// Used by the route guard AND by link parsing, so a deep link is classified by exactly the table the screens are guarded by.
import type { GatedMode } from '../contracts/gap-mob-session';

export type AccessClass = 'PUBLIC' | 'GUEST_PROMPT' | 'AUTHENTICATED' | 'MODE_GATED';

export interface RouteSpec {
  readonly access: AccessClass;
  readonly mode?: GatedMode;
}

export const ROUTES = {
  '/home': { access: 'PUBLIC' },
  '/shop': { access: 'PUBLIC' },
  '/saved': { access: 'GUEST_PROMPT' },
  '/orders': { access: 'GUEST_PROMPT' },
  '/account': { access: 'GUEST_PROMPT' },
  '/search': { access: 'PUBLIC' },
  '/notifications': { access: 'GUEST_PROMPT' },
  '/messages': { access: 'AUTHENTICATED' },
  '/product/[productRef]': { access: 'PUBLIC' },
  '/scenes/[scenePostRef]': { access: 'PUBLIC' },
  '/sellers/[sellerRef]': { access: 'PUBLIC' },
  '/collections/[collectionRef]': { access: 'AUTHENTICATED' },
  '/chat/[conversationRef]': { access: 'AUTHENTICATED' },
  '/account/delete': { access: 'AUTHENTICATED' },
  '/save-to': { access: 'AUTHENTICATED' },
  '/auth/sign-in': { access: 'PUBLIC' },
  '/auth/verify': { access: 'PUBLIC' },
  '/companion': { access: 'MODE_GATED', mode: 'SELLER_COMPANION' },
  '/companion/notifications': { access: 'MODE_GATED', mode: 'SELLER_COMPANION' },
  '/companion/messages': { access: 'MODE_GATED', mode: 'SELLER_COMPANION' },
  '/companion/messages/[conversationId]': { access: 'MODE_GATED', mode: 'SELLER_COMPANION' },
  '/courier': { access: 'MODE_GATED', mode: 'COURIER' },
} as const satisfies Record<string, RouteSpec>;

export type RouteTemplate = keyof typeof ROUTES;

export interface SafeRoute {
  readonly template: RouteTemplate;
  readonly params: Readonly<Record<string, string>>;
}

/** An opaque reference: one path segment of safe characters, bounded. Anything else is rejected, never forwarded. */
const REF = /^[A-Za-z0-9_-]{1,128}$/;

const TEMPLATES = (Object.keys(ROUTES) as RouteTemplate[]).map((template) => ({
  template,
  parts: template.split('/').slice(1),
}));

/** Classifies a path (no scheme, no host, no query). Unknown, malformed or over-long input is null: never a route. */
export function matchRoute(path: string): SafeRoute | null {
  if (path.length === 0 || path.length > 512 || !path.startsWith('/')) return null;
  const segments = path.split('/').slice(1);
  if (segments.length > 1 && segments[segments.length - 1] === '') segments.pop(); // one trailing slash is the same route
  for (const { template, parts } of TEMPLATES) {
    if (parts.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i] as string;
      const segment = segments[i] as string;
      if (part.startsWith('[')) {
        if (!REF.test(segment)) ok = false;
        else params[part.slice(1, -1)] = segment;
      } else if (part !== segment) ok = false;
    }
    if (ok) return { template, params };
  }
  return null;
}

/** Rebuilds the path from VALIDATED parts only (never echoes raw input). */
export function pathOf(route: SafeRoute): string {
  return route.template.replace(/\[([A-Za-z]+)\]/g, (_whole, name: string) => route.params[name] ?? '');
}
