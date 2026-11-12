# WO-022 review guide -- messaging reliability

This guide covers what was fixed in messaging, why, and how to check it without a phone. Everything
was verified **in code and with automated tests only**. No Android or iOS run was made, and no
production credentials are needed.

## 1. The reliability defect that was fixed

- **What happened before.** When a Buyer's message got an unclear answer, the app said "Your message
  was not sent". An unclear answer is, for example, an error page from a network gateway, or a
  "created" reply the app could not read. The next Send was treated as a brand-new message.
- **What happens now.** The app says "Your message may already have been received". It keeps the
  exact message ready to be checked again.

## 2. Why the old behaviour was unsafe

- A gateway can fail **after** the Adulis server has already saved the message.
- Each message carries a one-time "idempotency key". The server uses it to recognise the same message
  sent twice and store it only once.
- The old app threw that key away on any unclear answer. Sending again therefore looked like a new
  message, and the Seller could receive it **twice**.
- The Seller side had been fixed in WO-021. The Buyer side was not.

## 3. How a safe retry works now

| The server's answer | What the Buyer sees | What happens next |
|---|---|---|
| Message accepted (with its id) | The message in the conversation | Done |
| A clear refusal from the Adulis server (its full error format) | "Your message was not sent...", text kept | The next Send is a new message (new key) |
| Anything unclear (no connection, timeout, gateway error page, unreadable reply) | "Your message may already have been received..." with **Try sending again** and **Edit the message instead** | **Try sending again** sends the identical message with the **same key**, so the server keeps it at most once. **Edit the message instead** unlocks the text; the next Send is a new message |

While the answer is unclear:
- the text cannot be edited;
- the Product cannot be removed or changed;
- nothing is sent automatically.

The conversation is read again, so a message the server did save appears.

## 4. When the server's reply cannot be read

A "created" (201) reply that is cut off or names no message is treated as **unclear, not failed**.
The message was very likely saved, so the key is kept. The same applies to a gateway error page
without the Adulis server's own error format.

## 5. How Product-context retries are protected

- A message about Product A is always retried as the same message about Product A, with the same
  key. It never goes to Product B, to no Product, or as different text.
- Before the retry the app checks the Product again:
  - **Product removed from sale in the meantime:** nothing is sent, the message stays "may already
    have been received", and the screen says the Product is no longer available.
  - **The check fails offline:** nothing is sent, and the screen says it could not check. Try again
    on the Product, then retry.
- To send something different, the Buyer first taps **Edit the message instead**.
- Opening a link to the same conversation with another Product does not swap the Product of a
  message that is still unclear.

**Also fixed.** If the conversation on screen changed without the screen closing, the unclear
message used to stay on screen. Try sending again could then have sent it into the other
conversation. Each conversation now starts clean (Buyer and Seller).

## 6. Seller messaging improvements

- The Messages list now says **"Conversations for {store} (@{handle})"**, so an Account with several
  stores always knows which inbox is open.
- Each conversation row shows its **last activity and when it started**.
- The reply area says **"Replies are sent as {store} (@{handle})."**
- Store replies use the same safe-retry rule as Buyer messages.

## 7. Still unsupported

- Buyer names or a conversation reference (a proposal is in `WO-022-SELLER-MESSAGING-UX.md`).
- Unread counts and previews.
- Hiding Messages for roles that cannot use it (needs the server to publish per-store capabilities;
  proposal B).
- The store-side wording for the "passed to the seller" line (proposal C, waiting for your approval).
- Product or Order attachments on Seller replies.
- Push, typing and read receipts.
- Whether a phone may use the Seller inbox at all is still the open contract question. A proposal is
  in `WO-022-SELLER-CHAT-CONTRACT-RECONCILIATION.md`.

## 8. Tests that were executed

- **Buyer chat:** 85 of 85. 16 are new, covering gateway 502/503/504, unreadable and incomplete 201,
  Product retries, unpublished Products, offline checks, conversation switching, closing and
  reopening, session expiry announcements, and an intermediary error that only looks like a server refusal.
- **Seller chat:** 43 of 43. 12 are new.
- **Whole mobile suite, in band:** 27 suites, 520 of 520.
- **Mutation checks:** putting the old rule back makes 11 new tests fail, and the code-only refusal rule makes 2 fail. Every mutation was restored.
- **Gates:** typecheck, lint, locale checks, dependency rules, docs, MT keys and error-locale.

## 9. Tests still deferred

Everything on a device: Android, iOS, TalkBack, Dark mode, enlarged text, the keyboard, and a real
gateway failure (it needs a local proxy). See `MOBILE-NATIVE-VALIDATION-BACKLOG.md`, "From WO-022".

## 10. Decisions for you

See `WO-022-FOUNDER-HANDOFF.md`, "Decisions for you".

## Code-level review (about 15 minutes, no emulator)

1. **The rule.**
   - `apps/mobile/src/buyer/chat.ts`, `sendOutcome`. Only an `ApiError` of kind `problem` is a
     refusal.
   - Compare `wasAnswered` in `apps/mobile/src/api/client.ts`. It is unchanged and still used by
     other mutations.
2. **Buyer use.**
   - `apps/mobile/src/buyer/Conversation.tsx`, the `send` function's `catch`
     (`const answered = sendOutcome(failure) === 'refused'`).
   - The acceptance check just above it.
   - The `frozen` flag that locks the text and the Product.
3. **Store use.** `apps/mobile/src/seller/seller-chat.ts`, `useStoreReply`'s `catch`: the same rule.
4. **Conversation keying.**
   - `apps/mobile/src/app/(buyer)/chat/[conversationRef].tsx` (`key={conversationRef}`).
   - `SellerConversation` in `apps/mobile/src/seller/SellerMessages.tsx`
     (key `${store.id}:${conversationId}`).
5. **Tests.**
   - `apps/mobile/src/buyer/chat.test.tsx`, last block "Uncertain-send reliability (WO-022)". Its
     `storing()` server saves on the first attempt and loses the answer.
   - `apps/mobile/src/seller/seller-chat.test.tsx`, the two WO-022 blocks.
6. **Run (from `apps/mobile`):**
   ```
   node scripts/check-locale-imports.mjs
   npx jest --runInBand src/buyer/chat.test.tsx src/seller/seller-chat.test.tsx
   ```
   Jest should report 128 tests.
