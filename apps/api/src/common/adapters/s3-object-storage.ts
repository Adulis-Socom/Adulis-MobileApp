import { S3Client, HeadObjectCommand, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createLogger } from '../logging';
import type { MediaStorageAdapter, SignedUpload, StoredObject } from '../../modules/catalogue/media-storage.adapter';
import type { FinancialStorageAdapter } from '../../modules/financial/financial-storage.adapter';

const log = createLogger();

/**
 * THE ONE REAL OBJECT STORE (T20 S4). S3-compatible: MinIO on a developer
 * machine and in the e2e harness, Cloudflare R2 in production -- and the test
 * that this class is right is that switching between them changes NOTHING but
 * six environment values (T20 S4.1). If a switch ever needs more, this stopped
 * being one adapter.
 *
 * ONE IMPLEMENTATION, TWO TOKENS, TWO INSTANCES. MEDIA_STORAGE_ADAPTER and
 * FINANCIAL_STORAGE_ADAPTER stay separate on purpose -- grep the importers of
 * the financial one and you hold the complete list of code that can touch
 * payment-evidence bytes (the D-48 discipline carried into storage). The
 * separation the tokens draw in code, the BUCKETS draw in storage:
 *
 *   R2_MEDIA_BUCKET     public read. Product photographs are public by
 *                       intent; keys carry a randomUUID() segment and the
 *                       storefront discloses keys only for published
 *                       products, so there is nothing to enumerate.
 *   R2_EVIDENCE_BUCKET  NO public policy to misconfigure. evidence/raw/ is
 *                       PLAINTEXT for the window between a buyer's upload and
 *                       the commit that encrypts and deletes it -- a
 *                       bucket-level public policy would expose exactly that
 *                       window, which is why "one bucket, two prefixes" was
 *                       rejected (T19 S3.1 ruling, D-247).
 *
 * ENDPOINT RESOLUTION. R2_ACCOUNT_ID is either a Cloudflare account id (the
 * endpoint is derived: https://{id}.r2.cloudflarestorage.com, virtual-host
 * style) or a full http(s) URL (used verbatim, path-style -- MinIO). That one
 * value is what moves an environment between the two, by design.
 *
 * WHAT signPut DOES NOT ENFORCE, stated so nobody believes otherwise: a
 * presigned PUT cannot carry a size limit. maxBytes is advisory at signing;
 * the COMMIT re-inspects the object that actually landed and enforces the
 * byte caps there (catalogue.service IMAGE_CAPS). The cap that matters before
 * any bytes move is the pre-mint position check, not this URL.
 */
export interface ObjectStorageConfig {
  readonly accountId: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;
}

export class S3ObjectStorage implements MediaStorageAdapter, FinancialStorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(cfg: ObjectStorageConfig, label: string) {
    const isUrl = /^https?:\/\//i.test(cfg.accountId);
    const endpoint = isUrl ? cfg.accountId : `https://${cfg.accountId}.r2.cloudflarestorage.com`;
    this.bucket = cfg.bucket;
    this.client = new S3Client({
      region: 'auto',
      endpoint,
      forcePathStyle: isUrl, // MinIO addresses buckets by path; R2 by host
      credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    });
    log.warn({
      msg: `[OBJECT STORE] ${label} bound to ${isUrl ? 'S3-compatible endpoint' : 'Cloudflare R2'} bucket "${cfg.bucket}".`,
    });
  }

  async signPut(key: string, contentType: string, maxBytes: number): Promise<SignedUpload> {
    void maxBytes; // enforced at COMMIT via inspect(); a presigned PUT cannot carry it
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 15 * 60 },
    );
    return { key, url, expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() };
  }

  async inspect(key: string): Promise<StoredObject | null> {
    try {
      const h = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { bytes: Number(h.ContentLength ?? 0), contentType: h.ContentType ?? '' };
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const r = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await r.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  async putObject(key: string, bytes: Buffer): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: bytes }));
  }

  async deleteObject(key: string): Promise<void> {
    await this.delete(key);
  }
}

function isNotFound(e: unknown): boolean {
  const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
  return err?.name === 'NotFound' || err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;
}

/**
 * The six values T20 S4.1 rules, read once. ALL SIX present -> real storage; any
 * absent -> null, and the caller binds the fake (which still refuses
 * production, so a production boot without credentials stays a loud failure
 * rather than a silent one).
 */
export interface ObjectStorageEnv {
  readonly media: ObjectStorageConfig;
  readonly evidence: ObjectStorageConfig;
  readonly mediaPublicOrigin: string;
}

export function resolveObjectStorageEnv(): ObjectStorageEnv | null {
  const accountId = process.env['R2_ACCOUNT_ID'];
  const accessKeyId = process.env['R2_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['R2_SECRET_ACCESS_KEY'];
  const mediaBucket = process.env['R2_MEDIA_BUCKET'];
  const evidenceBucket = process.env['R2_EVIDENCE_BUCKET'];
  const mediaPublicOrigin = process.env['R2_MEDIA_PUBLIC_ORIGIN'];
  if (!accountId || !accessKeyId || !secretAccessKey || !mediaBucket || !evidenceBucket || !mediaPublicOrigin) {
    return null;
  }
  return {
    media: { accountId, accessKeyId, secretAccessKey, bucket: mediaBucket },
    evidence: { accountId, accessKeyId, secretAccessKey, bucket: evidenceBucket },
    mediaPublicOrigin: mediaPublicOrigin.replace(/\/$/, ''),
  };
}
