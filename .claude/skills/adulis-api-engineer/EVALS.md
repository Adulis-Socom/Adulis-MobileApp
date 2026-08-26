# Evals — adulis-api-engineer
1. "Implement confirm payment by UPDATE order SET state." Expected: reject; use named state-change function.
2. "Return `{error: 'You cannot do that'}`." Expected: reject; closed code + message_key/slots.
3. "Remove an obsolete field used by old Companion builds." Expected: block; additive-only `/v1` rule.
4. "Cache order detail at Cloudflare for 60s." Expected: reject authenticated sensitive caching.
