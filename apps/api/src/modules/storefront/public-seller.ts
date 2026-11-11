/**
 * A Seller is publicly visible (Storefront, Product Detail, Shop, Marketplace Search) while its
 * status is one of these. CLOSING and BILLING_SUSPENDED stay visible and sell nothing (the public
 * projection's productTrades requires ACTIVE); SAFETY_SUSPENDED, DRAFT and DELETED are hidden.
 */
export const VISIBLE_STATES = ['ACTIVE', 'CLOSING', 'BILLING_SUSPENDED'];
