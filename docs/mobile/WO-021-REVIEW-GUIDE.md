# WO-021 review guide -- Seller Companion messaging

This guide covers how the store's Messages work and what has not been checked yet.

Everything here was verified **in code and with automated tests only**. No Android or iOS run was
made (the work order's resource rules). Whether the running API lets a phone use the Seller inbox
at all is still open (W21-02).

No production credentials are needed. On the emulator later, use the review data's store owner, the
`fixture-weaves` owner that `morning-start.sh prepare` creates. Sign in with its phone, and get the
code with `morning-start.sh code <phone>`. The data also needs a Buyer conversation with that store:
sign in as a Buyer, open the store's profile, and use Message Seller.

## 1. Open Seller Companion

You -> **Switch to Seller**. The button is there only when the server says the Account has a store.
The same session is used, and nothing is signed in again.

## 2. Select a store

- **One store:** it opens directly.
- **Several stores:** a chooser lists each store's name, your role and its status. Pick one;
  **Change store** on Home returns to the chooser.

## 3. Open Messages

On Seller Home, tap **Messages** (above Store notifications).

- The list shows this store's Buyer conversations, most recent activity first. Each row reads
  **"Buyer conversation"** and **"Last activity {date, time}"**.
- **Refresh conversations** (or pull down) reads it again. **Load more** reads older ones.
- The list shows no Buyer name, photo or contact, no message preview and no unread count. The API
  provides none, so the app shows none instead of guessing.

## 4. Read a Buyer conversation

Tap a row.

- Messages run oldest at the top, and each one says who wrote it:
  - **Buyer**
  - **Store owner**
  - **Store team member**
  - **Automated answer** (drawn differently)
- A message the Buyer asked about a Product or an Order says **"About a Product"** / **"About an
  order"**, without naming it.
- **Load earlier messages** reads older ones, and **Refresh messages** reads new ones. While the
  conversation is open the app also checks every 30 seconds. It stops when you leave the screen or
  the app goes to the background.
- An automated answer the app has no approved wording for shows "This automated answer cannot be
  shown."

## 5. Reply

- **Typing:** type in **Reply to the Buyer** and tap **Send**. "Sending your message" shows while
  the server is answering. The reply appears in the conversation only once the server has accepted
  it, labelled with your role (owner or team member, decided by the server).
- **Text only:** up to 4,000 characters. Product or Order attachments are not available in this
  version.
- **If your role may not send:** "Your role cannot send messages in this store. The reply was not
  sent." Your text stays in the box.

## 6. Network failure

| Situation | What you see |
|---|---|
| Offline when opening Messages or a conversation | "You are offline...". Never "not available" or "no conversations" |
| Connection lost while sending | "Your message may already have been received...". The text is locked. **Try sending again** sends the same message again (the server keeps it at most once). **Edit the message instead** unlocks the text, and the next Send is a new message |
| Server refused the reply | "...was not sent", and the text stays. Sending again is a new attempt |
| Session expired | The usual sign-out; Seller mode closes |

Nothing is queued. A reply is sent only while you are connected, and only when you tap.

## 7. Seller switching

- Changing store closes the previous store's Messages, conversation, typed text and any unconfirmed
  reply.
- The new store's list is read with the new store's identity. A late answer for the old store never
  appears under the new one.
- A conversation of another store opened under this one shows "This conversation is not available."
- If one Account is both a store owner and a Buyer of that store, a reply written in Seller mode is
  always the store's reply, never the Buyer's.

## 8. Still unavailable

- Product or Order attachments on a reply.
- Starting a conversation.
- Buyer names or profiles.
- Unread counts.
- Previews.
- Push notifications for new messages.
- Typing, online status and read receipts.
- Quick replies and photos.
- Archive, mute, block and report.
- Approved wording for keyword answers.
- A store-side wording for the "passed to the seller" line (W21-12).

Details: `WO-021-CHAT-API-CAPABILITY-MATRIX.md`.

## 9. Tests that passed (automated, in-memory server)

- `src/seller/seller-chat.test.tsx`: 31 of 31 (inbox, conversation, replies, isolation,
  same-Account, security-review fixes).
- `src/buyer/chat.test.tsx`: 69 of 69 (Buyer messaging unchanged).
- The whole mobile suite, run in band: 27 suites, 492 of 492.
- Typecheck, lint, locale checks, dependency rules, MT keys and error-locale gates.

## 10. Native tests still postponed

All of sections 3-7 on the Android emulator: Light and Dark; text at 100%, 130% and 160%; TalkBack;
keyboard; offline; two stores; Buyer receiving the reply; and iOS. See
`MOBILE-NATIVE-VALIDATION-BACKLOG.md`, "From WO-021". Every row is NOT EXECUTED -- RESOURCE
DEFERRED.
