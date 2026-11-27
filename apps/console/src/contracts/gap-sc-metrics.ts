/**
 * PROVISIONAL fixture contract GAP-SC-18 (shared): one aggregate figure as the server resolved it. NOT the API contract.
 * Sources: ANL-01 v3.3 (server-authoritative aggregates, privacy thresholds, role scope), CONSOLE-02 v4.3 S83-S89, CHATBOT-01 S78.
 *
 * The Console never computes a figure and never turns a missing one into zero. Each state is distinct on screen:
 *  VALUE        a number the server counted (zero is a real zero);
 *  WITHHELD     counted, but below the privacy threshold for this audience, so not shown;
 *  UNKNOWN      the server cannot determine it for this window (incomplete data);
 *  UNAVAILABLE  not computed right now (projection behind, or not collected yet);
 *  UNSUPPORTED  this release does not measure it at all (for example anything that needs real Orders, D24-01).
 */
export type MetricState = 'VALUE' | 'WITHHELD' | 'UNKNOWN' | 'UNAVAILABLE' | 'UNSUPPORTED';
export type Metric = { readonly state: 'VALUE'; readonly value: number } | { readonly state: Exclude<MetricState, 'VALUE'> };
