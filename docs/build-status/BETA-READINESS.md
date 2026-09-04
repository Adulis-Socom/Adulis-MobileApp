# BETA READINESS

One question: can a real seller in Addis use this for six months without Naod
intervening?

This is not a defect list. It is what happened when the fourteen-step seller
journey was walked on a reset database by an account the seed had never seen,
through the built console in a real browser against the real API. Nothing below
is inferred. Every entry names the step it was hit on and the command or the
screenshot that shows it. Screenshots are `apps/console/e2e/.walk/`, written by
`pnpm verify:console-e2e`.

Three items a seller can complete unaided were confirmed working and are not
listed: sign-up (a code arrives for a new phone, the age declaration is asked on
the step that creates the account), store creation itself, and product creation.
Eligibility passes without the seller doing anything, because this market's
configuration requires no audience -- so step 3 is not a barrier.

---

## CANNOT

**1. Nothing can be deployed. (before step 1)**

The API refuses to start in production.

```
$ NODE_ENV=production node dist/main.js
Error: FakeSocialPlatformAdapter: a FAKE adapter cannot run in production.
Bind the real integration or do not start this process.
```

Eight fake adapters each throw on construction, so removing one only reveals the
next: SMS, push, social platforms, post links, object storage, financial
storage, inference, and the SMS provider wrapper. No vendor is wired for any of
them. This is not a bug -- the guard is deliberate and correct, and a fake SMS
adapter in production would send no codes while the logs looked healthy. But it
means the honest status is that a seller in Addis cannot reach this software at
all, on any day, and every item below is downstream of that.

**2. No buyer can ever see the store. (step 7)**

There is no storefront. `apps/storefront` does not exist. `apps/mobile` contains
zero source files behind a placeholder `package.json`. The seller's own screens
for reservation, payment, handoff, review and claim are built and are exercised
against seeded data -- but nothing renders a store to a buyer and nothing lets a
buyer reserve anything.

Steps 8 through 13 of this walk could not be performed as a seller, and the
reason is not that they are unfinished: no buyer can start them. A seller who
publishes has published to nobody.

**3. A product cannot carry a photograph. (step 5) -- CLOSED, T20 S4.**

*The finding is kept as written below because it is what the walk found. What
follows it is what changed.*

> The product screen has no file input of any kind -- not a hidden one, not a
> disabled one. Screenshot `09-product-editor.png`. The screen states it plainly:
>
> > "Adding an image resizes it in your browser and uploads three sizes. That
> > upload step is not on this screen yet."
>
> The three image endpoints exist in the contract. The console never calls them,
> and the only storage implementation in the tree is a fake whose signed URL
> points at `https://fake-r2.local/` and which reads back from an in-memory map
> that only tests write to. Cloudflare R2 is decided; its credentials are not.
> This is the unwired adapter the order asked to be told about plainly: there is
> no real object-store class to configure, so this is not a credentials task.
>
> Without images there is no product, which makes this the first thing to fix
> after deployment exists.

**What closed it.** There is a real object-store class now
(`apps/api/src/common/adapters/s3-object-storage.ts`), the console calls the
three endpoints, and the gap sentence is gone from the screen because the
control it apologised for is on it.

**It is closed against a real object store, not against the fake.** `docker
compose` runs MinIO with the two buckets the design needs, and the adapter is
one S3 implementation bound to both under two different sets of values -- so
moving to Cloudflare R2 changes six environment variables and no code. That
equivalence is the whole reason MinIO is admissible as proof here: the adapter
cannot tell which one it is talking to.

**The proof is a browser and a real file**, not a passing unit test. The beta
walk's own step 5 now picks a PNG, resizes it in the page to three WebP
derivatives, PUTs each to a presigned URL, commits the row, and asserts the
rendered `<img>` reports `naturalWidth > 0` -- an assertion that a broken image
fails and a stubbed one cannot satisfy:

```
WALK [OK] step 5: a photograph uploads from the browser and renders on the product
```

and the objects are in the bucket under opaque, position-free keys:

```
products/<product>/img/<uuid>/thumb.webp
products/<product>/img/<uuid>/card.webp
products/<product>/img/<uuid>/full.webp
```

`SC-10 media` covers the rest of S4.5: the image appears in the storefront API
response, one can be deleted, the order can be changed by dragging, and a sixth
image is refused **before** the upload begins rather than after three PUTs have
already been paid for.

**What is still true.** Nothing here makes a buyer able to see the photograph:
fatal item 2 is untouched, and a product with a picture that nobody can visit is
still a product nobody can visit.

**4. No seller can ever publish. (step 6)**

Identity verification is one of the nine readiness items, and no seller can
satisfy it. It is satisfied by an operator attestation, or by a market row
declaring identity not required. Neither exists and neither is seller-reachable:

```
$ select count(*) from core.identity_config;             -> 0
$ select count(*) from verification.identity_attestation; -> 0
```

The rule fails closed when the configuration row is absent, so zero rows means
"required". The only endpoint that writes an attestation is operator-only and
returns 403 to a seller session. Readiness for the seller this walk created,
straight from the server:

```
IDENTITY_VERIFIED | f | COMPLETE_IDENTITY_VERIFICATION
```

The console routes that action to a screen the seller cannot act on.

This is the literal answer to the question the order asks. Publication requires
Naod, for every seller, every time, indefinitely.

**5. A seller cannot set payout on the day they sign up. (step 4)**

Payout details are another of the nine. There is exactly one payout write path,
and it refuses any device the account first saw inside the last twenty-four
hours -- which is, necessarily, every new seller's only device. The control is
drawn disabled. Screenshot `06b-payout-day-one.png`:

> "Payout changes are locked for twenty-four hours after a sign-in from a device
> we have not seen. If that was not you, review your active sessions.
> Locked until Sep 3, 2026, 10:08 PM."

Setting payout for the first time and changing it later are the same call, so
the first-time seller is caught by a rule written for the second case. Even with
everything else fixed, nobody can publish on their first day.

**6. A new seller cannot find how to create a store. (step 2)**

Sign-up succeeds and lands on a page whose only control is a box asking for a
store id. There is no link to store creation on it. `/s/new` has to be typed
into the address bar. Screenshot `02-after-signin.png`; the walk recorded
`no link from the chooser to creating a store`.

*Had to know something a seller would not:* the route `/s/new`. This is the
point where a real seller stops and messages Naod.

**7. A returning seller cannot get back into their store. (step 14)**

The next day the same page asks them to paste a store id they were never given.
The page carries one link, and it is not to their store. Screenshot
`12-return-next-day.png`. A seller who got in yesterday only because they were
told a URL cannot get in today.

---

## EMBARRASSES

**1. The console shows an internal register number to the seller. (steps 2, 14)**

> "The contract has no endpoint listing your stores yet (register D-97), so
> paste the store id you were given."

A seller reads "the contract", "endpoint" and a defect number. Cheap to fix: the
sentence is one string, and it stops being needed the moment entry 6 above is
fixed.

**2. The payout lock accuses a new seller of a break-in. (step 4)**

"a sign-in from a device we have not seen ... if that was not you" is the right
warning for a payout change from a strange phone. On the day someone signs up it
tells them their brand-new account may already be compromised. Cheap to fix:
distinguish the first set from a later change in the message.

**3. Variants are free text. (step 5)**

A seller types "Size M / Red" into a single box labelled "Variant (for example:
Size L)". It works -- the walk added one and the server returned
`["Size M / Red"]`. But nothing in the system knows that string is a size and a
colour. A dress in three sizes and two colours is six strings the seller must
type consistently by hand, with per-string stock, and one typo makes a seventh
variant nobody ordered. Screenshots `10-variant-form.png`, `11-after-variant.png`.
The screen admits it: "named options such as size and colour appear once the
server lists them."

Not cheap. The server has no attribute list to offer, so this is real work, but
it is the difference between listing a clothing line and keeping a spreadsheet.

**4. The product list tells a seller nothing about their products. (step 5)**

> "Stock, variants and images for each product are shown inside the product, not
> on this list yet."

A seller with forty products opens forty screens to find out what is out of
stock.

**5. The courier is told to phone because the screen has nothing. (step 10)**

> "The buyer name, the pickup point and the collection note are not reported to
> couriers yet; call the number above to arrange the handoff."

This one is seen by a third party the seller chose to trust, at the moment goods
change hands.

---

## SENTENCES

The tree carries seventeen of these, not fourteen. All seventeen are triaged
below, plus the payout lock -- which is not a gap sentence but is the one
seller-facing sentence in the console that is actually wrong. The test applied:
does the sentence tell a seller something they can act on, or does it tell them
about our engineering?

| Sentence | Verdict | Why |
|---|---|---|
| chooser gap ("no endpoint ... register D-97") | **FIX** | The only one that names a defect number to a seller. It should say how to get into their store, not why we cannot list it. Deleted outright once the store list exists. |
| media upload owed | **RETIRED (T20 S4)** | Was KEEP, and the reasoning was right while it stood: a seller who cannot find the image button needs to know it is absent, not that they are failing to find it. It retired the day its gap closed, which is what a KEEP verdict is for. The screen now says what the control does ("Add a photo", and the limit) instead of what it cannot do. |
| variants labels owed | **KEEP** | Explains why the box wants a typed string. Without it the free-text box looks like a mistake. |
| payout new-device lock | **FIX** | Accurate for a change, wrong for a first set. See embarrassment 2. |
| products cap unreported | **DELETE** | Tells the seller the limit exists, is unknown, and will be enforced later. That is three sentences of anxiety and no action. The server already refuses with a clear message when a limit is hit -- which is the honest moment to say so. |
| products row summary owed | **KEEP** | A seller scanning the list for stock needs to know the list is not the place. Retire it with the columns. |
| editor attributes owed | **DELETE** | Names a screen ("the category attribute list") that does not exist. It describes an intended design to a person who cannot use it. |
| stock confidence owed | **DELETE** | A seller does not know what stock confidence is and does not need to. This sentence teaches them a concept solely to say it is missing. |
| store profile logo owed | **KEEP** | Short, true, and answers the exact question a seller asks when they cannot find the logo field. |
| store identity recheck owed | **KEEP** | Prevents a seller repeatedly hunting for a re-check button. Wrong count on screen without it. |
| store couriers columns owed | **KEEP, then FIXED (T23 S3)** | A seller staring at a list of bare phone numbers needs to know that is all there is -- true, and the reason it stays. But it said the NAMES were "not reported by the server yet", and `core.person` has no name column at all, so the wait it described has no end (D-288). Now states the policy, then what is genuinely owed. |
| courier details owed | **KEEP, then FIXED (T23 S3)** | Load-bearing: it tells the courier what to do instead ("call the number above"). The only gap sentence that ends in an instruction, and it still ends in it. Its "buyer name ... not reported yet" clause was the same wrong fact as the two rows above (D-288). |
| claims detail history owed | **KEEP** | A seller assembling a case needs to know the trail shown is partial before they rely on it. |
| inbox columns owed | **KEEP, then FIXED (T23 S3)** | Same reason. The list is thin enough to look broken without it. Same correction: "Buyer names ... not reported by the server yet" promised a column the schema will never carry (D-288). |
| trade orders no buyer name | **KEEP** | Not a gap sentence at all -- it states a deliberate privacy decision. Reads as an apology for a feature; it is a policy. Worth rewording so it does not sit among the "not yet" sentences, but never deleted. |
| trade detail no buyer name | **KEEP** | Same, shorter. Correct as written. |
| insights analytics export owed | **DELETED (T23 S3)** | Advertises a paid feature ("Business") on a screen where it cannot be bought, and the plan comparison does not sell it either. Either sell it or say nothing. Carried out; D-226's absence of a faked control stays. |
| insights trust wire owed | **KEEP** | The seller's level drives what they can do; a blank panel with no explanation is worse. Retire it with the engine behind it. |

Twelve KEEP, two FIX, four DELETE -- and as of T20 S4 the first of the twelve
has retired, which is the mechanism working rather than a change of verdict. The
remaining eleven are honest and should retire the same way, the day their gap
closes.

> **T23 Phase 3 re-triaged the ten that were still standing, and three KEEPs
> came back FIX.** Not because the verdict was wrong -- each of the three does
> earn its place on the screen -- but because all three were triaged against a
> fact that is not true. They said a NAME was "not reported by the server yet".
> `core.person` carries an id and a hash; `core.account` carries a phone.
> **There is no name column anywhere for a person**, so "yet" described a wait
> with no end. The trade pair two rows below already said this correctly, and
> this table noticed that about the trade pair without noticing the other three
> were contradicting it (D-288). The other six KEEPs were re-checked against the
> tree, not carried forward, and all six are still true. Deleting the four removes four places where the console
talks about itself instead of to the seller, and costs nothing.

---

**Answer to the question: no.** Not in six months and not on day one -- the
software does not start in production, no buyer can see a store, no product can
carry a photograph, and every single seller needs Naod personally before they
can publish at all.

> **One of the four has since closed (T20 S4): a product can carry a
> photograph.** The answer does not change, because the other three did not. The
> heaviest of them is unchanged and is not an engineering task in this
> workstream: **no buyer can see the store**, so a seller can now put a
> photograph on a product that nobody can visit. Closing a fatal item moves the
> answer no closer to yes while a fatal item is still open -- that is what
> "fatal" means -- and the walk should be re-run rather than reasoned about when
> the next one closes.
