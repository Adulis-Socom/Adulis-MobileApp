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

export class NullInferenceAdapter implements InferenceAdapter {
  classify(): Promise<InferenceResult | null> {
    return Promise.resolve(null);
  }
}

/** Tests script it per case. */
export class FakeInferenceAdapter implements InferenceAdapter {
  next: InferenceResult | null = null;

  classify(): Promise<InferenceResult | null> {
    return Promise.resolve(this.next);
  }
}
