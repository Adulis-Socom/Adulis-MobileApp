// The one choke point between the app and the network (GOV-06 S2). Types only: nothing here imports a fixture or a
// concrete transport, so a type import can never pull one into a release bundle.
import type { MobileMessageKey } from '@adulis/locale/mobile';

export type TransportErrorCode = 'UNAVAILABLE' | 'REFUSED';

/** A failure the UI can show: a typed code and a catalogue key, never free text from the transport. */
export class TransportError extends Error {
  constructor(
    readonly code: TransportErrorCode,
    readonly messageKey: MobileMessageKey,
  ) {
    super(code);
    this.name = 'TransportError';
  }
}

export interface MobileTransport {
  readonly kind: 'live' | 'fixture';
  /** PROVISIONAL (GAP-L2-01): the operation name is a placeholder until the owner contract is generated. */
  request(operation: string): Promise<unknown>;
}

/** What a development-only fixture contributes to the UI. Null in every release (GOV-06 S1, S3). */
export interface FixtureUi {
  readonly bannerText: string;
}
