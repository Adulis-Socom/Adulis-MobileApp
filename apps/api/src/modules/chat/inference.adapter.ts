import { assertFakeIsPermitted } from '../../common/adapters/fake-guard';
/**
 * The metered layers of the S15.1 cascade (3: embedding similarity, 4:
 * model-as-classifier), behind an adapter like every deployment
 * integration.
 *
 * INVARIANT (S15.1) — the model never generates a response. The adapter
 * returns an INTENT ID or nothing; every reply is a template. An adapter
 * that returned prose would have nowhere to put it — chat.bot_turn has no
 * text column, deliberately (check 2).
 *
 * The Null adapter always misses, which degrades exactly as S15.1
 * specifies: layers 0-2 keep answering, everything else escalates. The
 * real embedding/classifier integration is deployment work (reported).
 */

export interface InferenceResult {
  readonly intentId: string;
  /** Which layer answered: EMBEDDING (3) or CLASSIFIER (4). */
  readonly path: 'EMBEDDING' | 'CLASSIFIER';
  readonly confidence: number;
  readonly modelId: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
}

export interface InferenceAdapter {
  classify(text: string, locale: string): Promise<InferenceResult | null>;
}

export const INFERENCE_ADAPTER = Symbol('INFERENCE_ADAPTER');

/**
 * NOT a fake, and so NOT guarded against production.
 *
 * "The bot never goes dark" (S15.1): with no layer-4 classifier bound,
 * layers 0-2 keep answering and everything above escalates — which is the
 * SPECIFIED degradation, identical to the behaviour at the inference cap. A
 * fake pretends to be a vendor and must refuse to run in production; this
 * one truthfully answers "I matched nothing", and refusing to start over it
 * would take the whole API down to disable one cascade layer.
 */
export class NullInferenceAdapter implements InferenceAdapter {
  constructor() {
    console.warn(
      '[NO CLASSIFIER] layer 4 of the S15.1 cascade is unbound; ' +
        'unmatched questions escalate to the seller, as specified.',
    );
  }

  classify(): Promise<InferenceResult | null> {
    return Promise.resolve(null);
  }
}

/** Tests script it per case. */
export class FakeInferenceAdapter implements InferenceAdapter {
  constructor() {
    assertFakeIsPermitted('FakeInferenceAdapter');
  }

  next: InferenceResult | null = null;

  classify(): Promise<InferenceResult | null> {
    return Promise.resolve(this.next);
  }
}
