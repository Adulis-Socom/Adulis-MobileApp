import { randomUUID } from 'node:crypto';
import { S3ObjectStorage, resolveObjectStorageEnv } from '../src/common/adapters/s3-object-storage';

/**
 * The real adapter against the disposable object store (the suites refuse any
 * other, test/global-setup.ts): a size is read from metadata alone, and a
 * limited read returns at most the bytes asked for. Objects are a few bytes
 * and live under a key unique to this run.
 */

const env = resolveObjectStorageEnv();
const runPrefix = `evidence/raw/test-${randomUUID()}`;

describe('S3ObjectStorage: size and limited read', () => {
  const storage = new S3ObjectStorage(env!.evidence, 'S3_ADAPTER_TEST');
  const key = `${runPrefix}/object`;
  const body = Buffer.from('0123456789abcdefghij');

  beforeAll(async () => {
    await storage.putObject(key, body);
  });
  afterAll(async () => {
    await storage.deleteObject(key);
  });

  it('reports the stored size without reading the body', async () => {
    expect(await storage.inspect(key)).toMatchObject({ bytes: body.length });
    expect(await storage.inspect(`${runPrefix}/absent`)).toBeNull();
  });

  it('a limited read returns at most the bytes asked for, from the start', async () => {
    expect((await storage.getObject(key, 10))?.toString()).toBe('0123456789');
    expect((await storage.getObject(key, 1))?.toString()).toBe('0');
  });

  it('a limit above the size, or none, returns the whole object', async () => {
    expect((await storage.getObject(key, 5 * 1024 * 1024 + 1))?.equals(body)).toBe(true);
    expect((await storage.getObject(key))?.equals(body)).toBe(true);
  });

  it('a missing object reads as null and a non-positive limit is refused', async () => {
    expect(await storage.getObject(`${runPrefix}/absent`, 10)).toBeNull();
    await expect(storage.getObject(key, 0)).rejects.toThrow(RangeError);
    await expect(storage.getObject(key, -5)).rejects.toThrow(RangeError);
    await expect(storage.getObject(key, 1.5)).rejects.toThrow(RangeError);
  });
});
