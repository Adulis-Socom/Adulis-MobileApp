/**
 * Evidence object storage. A SEPARATE adapter token from the media one on
 * purpose: grep its importers and you hold the complete list of code that
 * can touch payment evidence bytes — the same audit-boundary argument as
 * the financial pool (ADU-CON-02 section 6.2).
 *
 * Evidence is the one media class that DOES transit the API: R18 requires
 * it stored as our AEAD frames (a raw screenshot at a guessable key is the
 * disclosure S13 exists to prevent), so the commit fetches the buyer's raw
 * upload, encrypts, stores the framed object, and DELETES the raw — one
 * transit, 5 MB cap, priced in A1 and accepted.
 */

export interface SignedUpload {
  readonly key: string;
  readonly url: string;
  readonly expires_at: string;
}

export interface FinancialStorageAdapter {
  signPut(key: string, contentType: string, maxBytes: number): Promise<SignedUpload>;
  getObject(key: string): Promise<Buffer | null>;
  putObject(key: string, bytes: Buffer): Promise<void>;
  deleteObject(key: string): Promise<void>;
}

export const FINANCIAL_STORAGE_ADAPTER = Symbol('FINANCIAL_STORAGE_ADAPTER');

export class FakeFinancialStorageAdapter implements FinancialStorageAdapter {
  private readonly objects = new Map<string, Buffer>();

  seed(key: string, bytes: Buffer): void {
    this.objects.set(key, bytes);
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

  async getObject(key: string): Promise<Buffer | null> {
    return this.objects.get(key) ?? null;
  }

  async putObject(key: string, bytes: Buffer): Promise<void> {
    this.objects.set(key, bytes);
  }

  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
