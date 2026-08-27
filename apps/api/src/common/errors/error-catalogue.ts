/**
 * ADU-API-01 v1.6 section 7.1 — THE CODE TAXONOMY IS CLOSED.
 *
 * Every `code` on the wire is drawn from this table and from nowhere else. A
 * code invented in a service is a code with no catalogue entry, which renders
 * to the buyer as a generic apology in the one moment they needed to be told
 * what to do. Adding a code within /v1 is additive for clients — but it is a
 * change to ADU-API-01, never a decision taken in a pull request.
 *
 * `group` is what derives the localisation key (section 7.2): message_key is
 * MECHANICALLY `error.<group>.<code in lower snake case>` — the property that
 * lets the server and the two locale catalogues never drift, and lets the
 * completeness gate (7.3) be a script rather than a review.
 *
 * `retryable` is a SERVER decision on every envelope (section 7.2): whether
 * the client may offer "try again". The document rules two examples
 * (SOLD_OUT false, RATE_LIMITED true); the rest follow one principle —
 * retryable means "the same request could succeed without the caller
 * changing anything". A conflict the caller must react to is not retryable.
 */

export const ERROR_GROUPS = [
  'auth',
  'step_up',
  'rbac',
  'cart',
  'cart_line',
  'order',
  'payment',
  'handoff',
  'seller',
  'payout',
  'deletion',
  'request',
] as const;

export type ErrorGroup = (typeof ERROR_GROUPS)[number];

interface CatalogueEntry {
  readonly group: ErrorGroup;
  /** The status this code is served with unless the raise site overrides. */
  readonly status: number;
  readonly retryable: boolean;
}

export const ERROR_CATALOGUE = {
  // Auth
  OTP_INVALID: { group: 'auth', status: 401, retryable: true },
  OTP_EXPIRED: { group: 'auth', status: 401, retryable: true },
  OTP_ATTEMPTS_EXCEEDED: { group: 'auth', status: 429, retryable: false },
  OTP_PURPOSE_NOT_PERMITTED: { group: 'auth', status: 403, retryable: false },
  SESSION_EXPIRED: { group: 'auth', status: 401, retryable: false },
  SESSION_REVOKED: { group: 'auth', status: 401, retryable: false },
  AUDIENCE_NOT_PERMITTED: { group: 'auth', status: 403, retryable: false },
  RECOVERY_REQUIRED: { group: 'auth', status: 403, retryable: false },

  // Step-up
  STEP_UP_REQUIRED: { group: 'step_up', status: 403, retryable: false },
  STEP_UP_EXPIRED: { group: 'step_up', status: 403, retryable: false },
  STEP_UP_ACTION_MISMATCH: { group: 'step_up', status: 403, retryable: false },

  // RBAC
  PERMISSION_DENIED: { group: 'rbac', status: 403, retryable: false },
  OWNER_ONLY: { group: 'rbac', status: 403, retryable: false },

  // Cart
  CART_EMPTY: { group: 'cart', status: 409, retryable: false },
  CART_SELLER_CONFLICT: { group: 'cart', status: 409, retryable: false },
  CART_REVALIDATION_FAILED: { group: 'cart', status: 409, retryable: false },

  // Cart line items (arrive inside items[], never alone)
  INSUFFICIENT_STOCK: { group: 'cart_line', status: 409, retryable: false },
  SOLD_OUT: { group: 'cart_line', status: 409, retryable: false },
  PRICE_CHANGED: { group: 'cart_line', status: 409, retryable: false },
  NO_LONGER_PUBLISHED: { group: 'cart_line', status: 409, retryable: false },
  VARIANT_WITHDRAWN: { group: 'cart_line', status: 409, retryable: false },
  SELLER_UNAVAILABLE: { group: 'cart_line', status: 409, retryable: false },
  TRANSACTION_CAP_EXCEEDED: { group: 'cart_line', status: 409, retryable: false },

  // Order
  ILLEGAL_TRANSITION: { group: 'order', status: 409, retryable: false },
  ORDER_NOT_PAYABLE: { group: 'order', status: 409, retryable: false },
  ORDER_ALREADY_TERMINAL: { group: 'order', status: 409, retryable: false },
  DUPLICATE_RESERVATION: { group: 'order', status: 409, retryable: false },
  BUYER_COOLDOWN_ACTIVE: { group: 'order', status: 409, retryable: false },
  ORDER_NOT_READYABLE: { group: 'order', status: 409, retryable: false },

  // Payment
  EVIDENCE_REQUIRED: { group: 'payment', status: 409, retryable: false },
  // 413 is transport reality (the body limit speaks before any handler);
  // section 7's list omits it only because the limit sits below the API.
  EVIDENCE_TOO_LARGE: { group: 'payment', status: 413, retryable: false },
  PAYMENT_ALREADY_DECIDED: { group: 'payment', status: 409, retryable: false },
  NOT_ORDER_BUYER: { group: 'payment', status: 404, retryable: false },

  // Handoff
  SCAN_SIGNATURE_INVALID: { group: 'handoff', status: 409, retryable: false },
  SCAN_PREDATES_TOKEN: { group: 'handoff', status: 409, retryable: false },
  SCAN_NOT_ORDER_BUYER: { group: 'handoff', status: 404, retryable: false },
  COURIER_CANNOT_SCAN: { group: 'handoff', status: 403, retryable: false },

  // Seller
  PUBLICATION_BLOCKED: { group: 'seller', status: 409, retryable: false },
  ELIGIBILITY_NOT_SATISFIED: { group: 'seller', status: 409, retryable: false },
  TIER_LIMIT_REACHED: { group: 'seller', status: 409, retryable: false },
  LEVEL_LIMIT_REACHED: { group: 'seller', status: 409, retryable: false },
  HANDLE_TAKEN: { group: 'seller', status: 409, retryable: false },
  FULFILMENT_METHOD_REQUIRED: { group: 'seller', status: 409, retryable: false },
  PRODUCT_HAS_ACTIVE_ORDERS: { group: 'seller', status: 409, retryable: false },
  VARIANT_HAS_ACTIVE_ORDERS: { group: 'seller', status: 409, retryable: false },

  // Payout
  PAYOUT_LOCKED_RECOVERY: { group: 'payout', status: 409, retryable: false },
  PAYOUT_CHANGE_PENDING: { group: 'payout', status: 409, retryable: false },
  PAYOUT_PERMISSION_DENIED: { group: 'payout', status: 403, retryable: false },

  // Deletion
  DELETION_BLOCKED: { group: 'deletion', status: 409, retryable: false },
  DELETION_OWNER_ONLY: { group: 'deletion', status: 403, retryable: false },

  // Request
  VALIDATION_FAILED: { group: 'request', status: 400, retryable: false },
  IDEMPOTENCY_KEY_MISSING: { group: 'request', status: 400, retryable: false },
  IDEMPOTENCY_KEY_REUSED: { group: 'request', status: 409, retryable: false },
  RATE_LIMITED: { group: 'request', status: 429, retryable: true },
  // 403, not 426: section 7's status list is closed and does not admit 426.
  // The floor is ENFORCED at /v1/bootstrap (200 + client_status), so this
  // code is the backstop for a below-floor client that skipped bootstrap.
  CLIENT_UPGRADE_REQUIRED: { group: 'request', status: 403, retryable: false },
  PAYLOAD_TOO_LARGE: { group: 'request', status: 413, retryable: false },
  SELLER_CONTEXT_REQUIRED: { group: 'request', status: 400, retryable: false },
  SCOPE_PARAMETER_REQUIRED: { group: 'request', status: 400, retryable: false },

  // Not in section 7.1's table, but required by section 7's status list: the
  // ordinary not-found envelope (404 and 410 carry a code like every other
  // envelope; a scope failure is 404 AND CARRIES NO DETAIL - ADU-AUTH-01 S21).
  NOT_FOUND: { group: 'request', status: 404, retryable: false },
  GONE: { group: 'request', status: 410, retryable: false },
  INTERNAL: { group: 'request', status: 500, retryable: true },
} as const satisfies Record<string, CatalogueEntry>;

export type ErrorCode = keyof typeof ERROR_CATALOGUE;

/**
 * Section 7.2 — keys are DERIVED, not invented:
 * `error.<group>.<code in lower snake case>`, nothing else, ever.
 */
export function messageKeyFor(code: ErrorCode): string {
  return `error.${ERROR_CATALOGUE[code].group}.${code.toLowerCase()}`;
}

/** The `type` URI of the RFC 9457 envelope. Host-stable, code-derived. */
export function typeUriFor(code: ErrorCode): string {
  return `https://adulis.example/errors/${code.toLowerCase().replace(/_/g, '-')}`;
}
