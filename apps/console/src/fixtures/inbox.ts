import type { ConversationSummary, ContextKind, Message, MessageContext, SenderKind, ThreadState, ThreadView } from '../contracts/gap-sc-inbox';
import type { Catalogue } from './catalogue';
import type { Content } from './content';
import { HOUR_MS, invalid, need, needCap, notFound, withIdempotency, type Handlers, type Kit } from './kit';

/**
 * Fixture Inbox (GAP-SC-15, SC-FE-08). DEVELOPMENT ONLY. One Conversation per Buyer, Seller and Market; context belongs to each message
 * and never to the thread (CHAT S3-S4). The Scene a message came from is resolved on EVERY read, so a Scene that has since gone private is
 * shown as a safe "unavailable" reference and its newer content is never exposed. Nothing here is generated: automated messages are fixed
 * strings marked provisional, because no dialogue is approved (RB25-D09, founder review), and the only write is a human reply, a NAMED fixture
 * write that touches nothing but this module's own thread list (GOV-06 S2).
 *
 * Isolation: every lookup is by Seller first. A foreign or unknown conversation id is the same not-found as one that does not exist.
 */
const PAGE_SIZE = 4; // demonstration value: the real page size is the server's
const PREVIEW_CHARS = 80; // demonstration value: the server picks the excerpt

type InboxOps = 'inbox.list' | 'inbox.thread.get' | 'inbox.context.get' | 'inbox.reply.send' | 'inbox.read.mark';
export interface Inbox {
  readonly handlers: Handlers<InboxOps>;
}

interface MsgRec {
  id: string;
  sender: SenderKind;
  actor: string | null;
  body: string;
  productId: string | null;
  scene: { id: string; label: string } | null;
  at: number;
  automation: { template_label: string; provisional: true } | null;
}
interface ConvRec {
  id: string;
  buyer: string;
  state: ThreadState;
  /** How many messages the Seller side has read. One shared mark, monotonic. */
  readCount: number;
  msgs: MsgRec[];
}

export function createInbox(kit: Kit, catalogue: Catalogue, content: Content): Inbox {
  const data = new Map<string, ConvRec[]>();

  function seedFor(sellerId: string): ConvRec[] {
    const ago = (hours: number) => kit.now() - hours * HOUR_MS;
    let n = 0;
    const m = (sender: SenderKind, body: string, hoursAgo: number, extra: Partial<Pick<MsgRec, 'actor' | 'productId' | 'scene' | 'automation'>> = {}): MsgRec => ({
      id: `fx_msg_${sellerId.slice(10)}_${(n += 1)}`,
      sender,
      actor: extra.actor ?? null,
      body,
      productId: extra.productId ?? null,
      scene: extra.scene ?? null,
      at: ago(hoursAgo),
      automation: extra.automation ?? null,
    });
    const auto = (body: string, hoursAgo: number) => m('AUTOMATED', body, hoursAgo, { automation: { template_label: 'Provisional demonstration template', provisional: true } });
    if (sellerId === 'fx_seller_alem') {
      const p = (k: number) => `fx_prod_alem_${k}`;
      const scene = (k: number, label: string) => ({ id: `fx_scene_alem_${k}`, label });
      return [
        { id: 'fx_conv_alem_1', buyer: 'Demonstration buyer A', state: 'OPEN', readCount: 3, msgs: [
          m('BUYER', 'Is the linen wrap dress still available in size S?', 5, { productId: p(1), scene: scene(1, 'Linen wrap dress styled for the rainy season') }),
          auto('Thanks for your message. A team member will reply.', 5),
          m('SELLER_TEAM', 'Yes, we have it in size S.', 4, { actor: 'Team member', productId: p(1) }),
          m('BUYER', 'Thank you, that helps.', 1),
        ] },
        { id: 'fx_conv_alem_2', buyer: 'Demonstration buyer B', state: 'WAITING_FOR_HUMAN', readCount: 0, msgs: [
          m('BUYER', 'Hello, I have a question about the silk slip dress.', 2, { productId: p(3) }),
          auto('Thanks for your message. A team member will reply.', 2),
          m('SYSTEM', 'Automated help could not answer this. A team member is needed.', 2),
          m('BUYER', 'Does it come in other colours?', 0.5, { productId: p(3) }),
        ] },
        { id: 'fx_conv_alem_3', buyer: 'Demonstration buyer C', state: 'OPEN', readCount: 2, msgs: [
          m('BUYER', 'I love this look. Where is it from?', 30, { scene: scene(6, 'The old kaftan, styled two ways') }),
          m('SELLER_TEAM', 'It is from our own workshop.', 29, { actor: 'Team member', scene: scene(6, 'The old kaftan, styled two ways') }),
        ] },
        { id: 'fx_conv_alem_4', buyer: 'Demonstration buyer D', state: 'OPEN', readCount: 1, msgs: [m('BUYER', 'Do you have a shop I can visit?', 50)] },
        { id: 'fx_conv_alem_5', buyer: 'Demonstration buyer E', state: 'OPEN', readCount: 2, msgs: [
          m('BUYER', 'Good afternoon.', 100),
          m('SELLER_TEAM', 'Good afternoon, how can we help?', 99, { actor: 'Team member' }),
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
    if (!c) throw notFound();
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

  function contextOf(sellerId: string, msg: MsgRec): MessageContext {
    const scenes = content.scenesForContext(sellerId);
    const sc = msg.scene ? { id: msg.scene.id, label: msg.scene.label, available: scenes.find((s) => s.id === msg.scene?.id)?.isPublic === true } : null;
    const fact = msg.productId ? catalogue.fact(sellerId, msg.productId) : undefined;
    const product = msg.productId ? { id: msg.productId, label: fact?.title ?? '' } : null;
    const kind: ContextKind = product && sc ? 'PRODUCT_IN_SCENE' : product ? 'PRODUCT' : sc ? 'SCENE' : 'NONE';
    return { kind, product, scene: sc };
  }
  function message(sellerId: string, msg: MsgRec): Message {
    return { id: msg.id, sender: msg.sender, actor_label: msg.actor, body: msg.body, context: contextOf(sellerId, msg), sent_at: kit.iso(msg.at), automation: msg.automation };
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
      const eligible = catalogue.facts(a.sellerId).filter((f) => f.state === 'PUBLISHED');
      if (scene_id === null) return { seller_id: a.sellerId, scenes: scenes.map((s) => ({ id: s.id, label: s.label })), products: eligible.map((f) => ({ id: f.id, label: f.title })) };
      const scene = scenes.find((s) => s.id === scene_id);
      if (!scene) throw invalid({ scene: 'CONTEXT_SCENE_NOT_AVAILABLE' });
      return {
        seller_id: a.sellerId,
        scenes: scenes.map((s) => ({ id: s.id, label: s.label })),
        products: eligible.filter((f) => scene.productIds.includes(f.id)).map((f) => ({ id: f.id, label: f.title })),
      };
    },
    'inbox.reply.send': ({ conversation_id, body, scene_id, product_id }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'inbox');
      needCap(a, 'inbox.reply');
      const c = find(a.sellerId, conversation_id);
      const errors: Record<string, string> = {};
      if (body.trim() === '') errors['body'] = 'MESSAGE_BODY_REQUIRED';
      const scenes = content.scenesForContext(a.sellerId);
      const scene = scene_id === null ? null : (scenes.find((s) => s.id === scene_id && s.isPublic) ?? null);
      if (scene_id !== null && scene === null) errors['scene'] = 'CONTEXT_SCENE_NOT_AVAILABLE';
      if (product_id !== null) {
        const fact = catalogue.fact(a.sellerId, product_id);
        if (!fact || fact.state !== 'PUBLISHED') errors['product'] = 'CONTEXT_PRODUCT_NOT_AVAILABLE';
        else if (scene && !scene.productIds.includes(product_id)) errors['product'] = 'MESSAGE_PRODUCT_NOT_IN_SCENE';
      }
      if (Object.keys(errors).length > 0) throw invalid(errors);
      c.msgs.push({ id: kit.next('fx_msg'), sender: 'SELLER_TEAM', actor: 'Team member', body: body.trim(), productId: product_id, scene: scene ? { id: scene.id, label: scene.label } : null, at: kit.now(), automation: null });
      // A human reply continues the same thread and takes it back from automation; the reply itself is read by the person who wrote it.
      c.state = 'OPEN';
      c.readCount = c.msgs.length;
      return thread(a.sellerId, c, true);
    },
    'inbox.read.mark': ({ conversation_id }, ctx) => {
      const a = kit.authz(ctx);
      need(a, 'inbox');
      needCap(a, 'inbox.read');
      const c = find(a.sellerId, conversation_id);
      c.readCount = Math.max(c.readCount, c.msgs.length);
      return summary(c);
    },
  };

  return { handlers: withIdempotency(kit, handlers, { 'inbox.reply.send': { dest: 'inbox', cap: 'inbox.reply' } }) };
}
