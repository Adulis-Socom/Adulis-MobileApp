import { assertFakeIsPermitted } from '../../common/adapters/fake-guard';
/**
 * The signed-upload storage adapter (ADU-CON-02 section 8.1): media never
 * transits the API. The client resizes to the three derivatives, PUTs them
 * straight to R2 against URLs signed here, and the COMMIT call validates
 * what actually landed — bytes and pixel dimensions — before a row exists.
 *
 * No `sharp`, no server pipeline, and NO ORIGINAL KEY anywhere in the
 * interface: there is no URL at which an original could even arrive.
 *
 * The real adapter is Cloudflare R2 presigned PUTs (deployment secrets,
 * ADU-CON-02 section 18); locally and in tests the fake below records what
 * was signed and serves configured inspections.
 */

export interface SignedUpload {
  readonly key: string;
  readonly url: string;
  readonly expires_at: string;
}

export interface StoredObject {
  readonly bytes: number;
  readonly contentType: string;
  /** Pixel dimensions, parsed from the image header by ranged read. */
  readonly width?: number;
  readonly height?: number;
}

export interface MediaStorageAdapter {
  signPut(key: string, contentType: string, maxBytes: number): Promise<SignedUpload>;
  /** HEAD + ranged header read; null when the object does not exist. */
  inspect(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}

export const MEDIA_STORAGE_ADAPTER = Symbol('MEDIA_STORAGE_ADAPTER');

/** Local/test adapter: tests register objects; signing is deterministic. */
export class FakeMediaStorageAdapter implements MediaStorageAdapter {
  constructor() {
    assertFakeIsPermitted('FakeMediaStorageAdapter');
  }

  private readonly objects = new Map<string, StoredObject>();

  put(key: string, obj: StoredObject): void {
    this.objects.set(key, obj);
  }

  async signPut(key: string, contentType: string, maxBytes: number): Promise<SignedUpload> {
    void contentType;
    void maxBytes;
    return {
      key,
      url: `https://fake-r2.local/put/${encodeURIComponent(key)}`,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async inspect(key: string): Promise<StoredObject | null> {
    return this.objects.get(key) ?? null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
