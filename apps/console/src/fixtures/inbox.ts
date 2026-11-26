import type { ConversationSummary, Message, MessageSubject, SceneReference, SenderKind, ThreadState, ThreadView } from '../contracts/gap-sc-inbox';
import { TransportError } from '../transport/port';
import type { Catalogue } from './catalogue';
import type { Content } from './content';
import { HOUR_MS, invalid, need, needCap, withIdempotency, type Handlers, type Kit } from './kit';

/**
 * Fixture Inbox (GAP-SC-15, SC-FE-08). DEVELOPMENT ONLY. One Conversation per Buyer, Seller and Market; context belongs to each message
 * and never to the thread (CHAT S3-S4). Each message stores ONE subject and, for a Product chosen from a Scene, the Scene as provenance, both
 * with the exact Scene revision and a display snapshot taken when it was sent: history never re-reads the current Product or Scene. Only
 * whether the Scene can be opened NOW is resolved on every read, so a Scene that has gone private is a safe "unavailable" reference and its
 * newer content is never exposed. Nothing here is generated: automated messages are fixed strings marked provisional, because no dialogue is
 * approved (RB25-D09, founder review), and the only write is a human reply, a NAMED fixture write that touches nothing but this module's
 * own thread list (GOV-06 S2).
 *
 * Isolation: every lookup is by Seller first. A foreign or unknown conversation id is the same not-found as one that does not exist.
 */
const PAGE_SIZE = 4; // demonstration value: the real page size is the server's
const PREVIEW_CHARS = 80; // demonstration value: the server picks the excerpt
/** The actual person behind a reply (CHAT S9), by demonstration account. A real server records the signed-in account's own name. */
const ACTORS: Readonly<Record<string, string>> = { fx_acct_owner: 'Alem', fx_acct_admin: 'Selam', fx_acct_sales: 'Tigist', fx_acct_multirole: 'Tigist', fx_acct_states: 'Dawit', fx_acct_mixed: 'Lemlem' };

type InboxOps = 'inbox.list' | 'inbox.thread.get' | 'inbox.context.get' | 'inbox.reply.send' | 'inbox.read.mark';
export interface Inbox {
  readonly handlers: Handlers<InboxOps>;
  /** Test hook: a Buyer message arrives now, as a real Buyer's would, without the Console having seen it. */
  arrive(sellerId: string, conversationId: string, body: string): boolean;
}

type SceneSnap = Omit<SceneReference, 'available'>;
type SubjectRec = { kind: 'NONE' } | { kind: 'PRODUCT'; ref: string; label: string } | ({ kind: 'SCENE' } & SceneSnap);
/** Immutable once accepted: no field of a stored message is ever rewritten (CHAT S4). */
interface MsgRec {
  readonly id: string;
  readonly sender: SenderKind;
  readonly actor: string | null;
  readonly body: string;
  readonly subject: SubjectRec;
  readonly source: SceneSnap | null;
  readonly at: number;
  readonly automation: { template_label: string; provisional: true } | null;
}
interface ConvRec {
  id: string;
  buyer: string;
  state: ThreadState;
  /** High-water: how many messages, from the start, the Seller side has read. One shared mark, monotonic (CHAT S10). */
  readCount: number;
  msgs: MsgRec[];
}
const NO_SUBJECT: SubjectRec = { kind: 'NONE' };

export function createInbox(kit: Kit, catalogue: Catalogue, content: Content): Inbox {
  const data = new Map<string, ConvRec[]>();

  function seedFor(sellerId: string): ConvRec[] {
    const ago = (hours: number) => kit.now() - hours * HOUR_MS;
    let n = 0;
    const m = (sender: SenderKind, body: string, hoursAgo: number, extra: Partial<Pick<MsgRec, 'actor' | 'subject' | 'source' | 'automation'>> = {}): MsgRec => ({
      id: `fx_msg_${sellerId.slice(10)}_${(n += 1)}`,
      sender,
      actor: extra.actor ?? null,
      body,
      subject: extra.subject ?? NO_SUBJECT,
      source: extra.source ?? null,
      at: ago(hoursAgo),
      automation: extra.automation ?? null,
    });
    // Display snapshots as they were when each seeded message was sent.
    const product = (id: string): SubjectRec => ({ kind: 'PRODUCT', ref: id, label: catalogue.fact(sellerId, id)?.title ?? '' });
    const auto = (body: string, hoursAgo: number) => m('AUTOMATED', body, hoursAgo, { automation: { template_label: 'Provisional demonstration template', provisional: true } });
    if (sellerId === 'fx_seller_alem') {
      const p = (k: number) => product(`fx_prod_alem_${k}`);
      const scene = (k: number, label: string): SceneSnap => ({ ref: `fx_scene_alem_${k}`, revision: 1, label });
      return [
        { id: 'fx_conv_alem_1', buyer: 'Demonstration buyer A', state: 'OPEN', readCount: 3, msgs: [
          m('BUYER', 'Is the linen wrap dress still available in size S?', 5, { subject: p(1), source: scene(1, 'Linen wrap dress styled for the rainy season') }),
          auto('Thanks for your message. A team member will reply.', 5),
          m('SELLER_TEAM', 'Yes, we have it in size S.', 4, { actor: 'Selam', subject: p(1) }),
          m('BUYER', 'Thank you, that helps.', 1),
        ] },
        { id: 'fx_conv_alem_2', buyer: 'Demonstration buyer B', state: 'WAITING_FOR_HUMAN', readCount: 0, msgs: [
          m('BUYER', 'Hello, I have a question about the silk slip dress.', 2, { subject: p(3) }),
          auto('Thanks for your message. A team member will reply.', 2),
          m('SYSTEM', 'Automated help could not answer this. A team member is needed.', 2),
          m('BUYER', 'Does it come in other colours?', 0.5, { subject: p(3) }),
        ] },
        { id: 'fx_conv_alem_3', buyer: 'Demonstration buyer C', state: 'OPEN', readCount: 2, msgs: [
          m('BUYER', 'I love this look. Where is it from?', 30, { subject: { kind: 'SCENE', ...scene(6, 'The old kaftan, styled two ways') } }),
          m('SELLER_TEAM', 'It is from our own workshop.', 29, { actor: 'Selam', subject: { kind: 'SCENE', ...scene(6, 'The old kaftan, styled two ways') } }),
        ] },
        { id: 'fx_conv_alem_4', buyer: 'Demonstration buyer D', state: 'OPEN', readCount: 1, msgs: [m('BUYER', 'Do you have a shop I can visit?', 50)] },
        { id: 'fx_conv_alem_5', buyer: 'Demonstration buyer E', state: 'OPEN', readCount: 2, msgs: [
          m('BUYER', 'Good afternoon.', 100),
          m('SELLER_TEAM', 'Good afternoon, how can we help?', 99, { actor: 'Tigist' }),
        ] },
      ];
    }
    if (sellerId === 'fx_seller_biruk') {
      return [{ id: 'fx_conv_biruk_1', buyer: 'Demonstration buyer F', state: 'OPEN', readCount: 0, msgs: [m('BUYER', 'Do you have these shoes in a larger size?', 3)] }];
    }
    return [];
  }
  const convsOf = (sellerId: string): ConvRec[] => {
    let list = data.get(sellerId);
    if (!list) {
      list = seedFor(sellerId);
      data.set(sellerId, list);
    }
    return list;
  };
  const find = (sellerId: string, id: string): ConvRec => {
    const c = convsOf(sellerId).find((x) => x.id === id);
    // CHAT S15: CONVERSATION_NOT_FOUND, the same for a foreign id and a missing one (no resource enumeration).
    if (!c) throw new TransportError('NOT_FOUND', { detail: 'CONVERSATION_NOT_FOUND' });
    return c;
  };
  const last = (c: ConvRec): MsgRec => c.msgs[c.msgs.length - 1] as MsgRec;
  const unread = (c: ConvRec): number => c.msgs.slice(c.readCount).filter((x) => x.sender === 'BUYER').length;

  function summary(c: ConvRec): ConversationSummary {
    const l = last(c);
    return {
      id: c.id,
      buyer_label: c.buyer,
      preview: l.body.length > PREVIEW_CHARS ? `${l.body.slice(0, PREVIEW_CHARS)}...` : l.body,
      last_sender: l.sender,
      last_at: kit.iso(l.at),
      unread_count: unread(c),
      state: c.state,
    };
  }

  function message(sellerId: string, msg: MsgRec): Message {
    const publicNow = new Set(content.scenesForContext(sellerId).filter((x) => x.isPublic).map((x) => x.id));
    // Only accessibility is current; label and revision are the snapshot the message was sent with.
    const reference = (snap: SceneSnap): SceneReference => ({ ...snap, available: publicNow.has(snap.ref) });
    const subject: MessageSubject = msg.subject.kind === 'SCENE' ? { ...reference(msg.subject), kind: 'SCENE' } : msg.subject;
    return { id: msg.id, sender: msg.sender, actor_label: msg.actor, body: msg.body, subject, source: msg.source ? reference(msg.source) : null, sent_at: kit.iso(msg.at), automation: msg.automation };
  }
  function thread(sellerId: string, c: ConvRec, canReply: boolean): ThreadView {
    return { seller_id: sellerId, id: c.id, buyer_label: c.buyer, state: c.state, version: c.msgs.length, messages: c.msgs.map((x) => message(sellerId, x)), allowed_actions: canReply ? ['REPLY'] : [] };
  }

  const handlers: Inbox['handlers'] = {
    'inbox.list': ({ cursor }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'inbox');
      needCap(a, 'inbox.read');
      const sorted = [...convsOf(a.sellerId)].sort((x, y) => last(y).at - last(x).at);
      const start = cursor === null ? 0 : Number(cursor);
      const page = sorted.slice(start, start + PAGE_SIZE);
      return { seller_id: a.sellerId, items: page.map(summary), next_cursor: start + PAGE_SIZE < sorted.length ? String(start + PAGE_SIZE) : null };
    },
    'inbox.thread.get': ({ conversation_id }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'inbox');
      needCap(a, 'inbox.read');
      return thread(a.sellerId, find(a.sellerId, conversation_id), a.caps.has('inbox.reply'));
    },
    'inbox.context.get': ({ scene_id }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'inbox');
      needCap(a, 'inbox.read');
      const scenes = content.scenesForContext(a.sellerId).filter((s) => s.isPublic);
      const listed = scenes.map((s) => ({ id: s.id, label: s.label, revision: s.revision }));
      const eligible = catalogue.facts(a.sellerId).filter((f) => f.state === 'PUBLISHED');
      if (scene_id === null) return { seller_id: a.sellerId, scenes: listed, products: eligible.map((f) => ({ id: f.id, label: f.title })) };
      const scene = scenes.find((s) => s.id === scene_id);
      if (!scene) throw invalid({ scene: 'MESSAGE_SCENE_POST_INVALID' });
      return { seller_id: a.sellerId, scenes: listed, products: eligible.filter((f) => scene.productIds.includes(f.id)).map((f) => ({ id: f.id, label: f.title })) };
    },
    'inbox.reply.send': ({ conversation_id, body, scene_id, scene_revision, product_id }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'inbox');
      needCap(a, 'inbox.reply');
      const c = find(a.sellerId, conversation_id);
      const errors: Record<string, string> = {};
      if (body.trim() === '') errors['body'] = 'MESSAGE_EMPTY';
      // CHAT S5 selector rules. A Scene must come with the revision it was offered at, and must be public NOW.
      let source: SceneSnap | null = null;
      let tagged: readonly string[] | null = null;
      if ((scene_id === null) !== (scene_revision === null)) errors['scene'] = 'MESSAGE_CONTEXT_CONFLICT';
      else if (scene_id !== null && scene_revision !== null) {
        const current = content.scenesForContext(a.sellerId).find((s) => s.id === scene_id && s.isPublic);
        tagged = content.tagsAtRevision(a.sellerId, scene_id, scene_revision);
        if (!current || tagged === null) errors['scene'] = 'MESSAGE_SCENE_POST_INVALID';
        else source = { ref: scene_id, revision: scene_revision, label: current.label };
      }
      let product: { id: string; label: string } | null = null;
      if (product_id !== null) {
        const fact = catalogue.fact(a.sellerId, product_id);
        if (!fact || fact.state !== 'PUBLISHED') errors['product'] = 'MESSAGE_PRODUCT_POST_INVALID';
        // Membership in the EXACT referenced revision: an untagged Product never acquires Scene provenance (CHAT S4, S14).
        else if (source && tagged && !tagged.includes(product_id)) errors['product'] = 'MESSAGE_PRODUCT_NOT_IN_SCENE_POST';
        else product = { id: fact.id, label: fact.title };
      }
      if (Object.keys(errors).length > 0) throw invalid(errors);
      // One primary subject: the Product (the Scene becomes its provenance), else the whole Scene, else none.
      const subject: SubjectRec = product ? { kind: 'PRODUCT', ref: product.id, label: product.label } : source ? { kind: 'SCENE', ...source } : NO_SUBJECT;
      c.msgs.push({ id: kit.next('fx_msg'), sender: 'SELLER_TEAM', actor: ACTORS[a.accountId] ?? 'A team member', body: body.trim(), subject, source: product ? source : null, at: kit.now(), automation: null });
      // A human reply continues the same thread and takes it back from automation. It does not move the read mark: the Console marks what it shows.
      c.state = 'OPEN';
      return thread(a.sellerId, c, true);
    },
    'inbox.read.mark': ({ conversation_id, last_read_message_id }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'inbox');
      needCap(a, 'inbox.read');
      const c = find(a.sellerId, conversation_id);
      const position = c.msgs.findIndex((x) => x.id === last_read_message_id);
      if (position < 0) throw invalid({ last_read_message_id: 'MESSAGE_NOT_IN_CONVERSATION' });
      // High-water, monotonic: never backwards, and never past the message the Console says it showed.
      c.readCount = Math.max(c.readCount, position + 1);
      return summary(c);
    },
  };

  return {
    handlers: withIdempotency(kit, handlers, { 'inbox.reply.send': { dest: 'inbox', cap: 'inbox.reply' } }),
    arrive(sellerId, conversationId, body) {
      const c = convsOf(sellerId).find((x) => x.id === conversationId);
      if (!c) return false;
      c.msgs.push({ id: kit.next('fx_msg'), sender: 'BUYER', actor: null, body, subject: NO_SUBJECT, source: null, at: kit.now(), automation: null });
      return true;
    },
  };
}
