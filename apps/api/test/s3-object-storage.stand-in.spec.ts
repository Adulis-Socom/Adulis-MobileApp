import 'reflect-metadata';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo, Socket } from 'node:net';
import { AppModule } from '../src/app.module';
import {
  EVIDENCE_CLIENT_OPTIONS,
  S3ObjectStorage,
  type StorageClientOptions,
} from '../src/common/adapters/s3-object-storage';
import {
  FINANCIAL_STORAGE_ADAPTER,
  type FinancialStorageAdapter,
} from '../src/modules/financial/financial-storage.adapter';

/**
 * The real adapter (and the real SDK) against a stand-in store on loopback that
 * does not behave: it ignores a range, declares a length it never sends, sends
 * a checksum for the whole object on a partial answer, or never answers. Nothing
 * large is ever created: a size is only REPORTED in a header, and a stream that
 * is dropped by the client stops at once.
 */

type Handler = (req: IncomingMessage, res: ServerResponse) => void;

const sockets = new Set<Socket>();
const servers: Server[] = [];

async function standIn(handler: Handler): Promise<string> {
  const server = createServer(handler);
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

const adapter = (url: string, options: StorageClientOptions = EVIDENCE_CLIENT_OPTIONS) =>
  new S3ObjectStorage(
    { accountId: url, accessKeyId: 'k', secretAccessKey: 's', bucket: 'b' },
    'STAND_IN_TEST',
    options,
  );

/** Resolves with the promise's outcome, or with 'timed out' if it takes longer than `ms`. */
async function within<T>(ms: number, promise: Promise<T>): Promise<T | 'timed out'> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<'timed out'>((resolve) => {
        timer = setTimeout(() => resolve('timed out'), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

const WHOLE = Buffer.from('0123456789abcdefghij');

afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
});

describe('S3ObjectStorage against a stand-in store', () => {
  it('a store that honours the range returns just those bytes', async () => {
    const url = await standIn((req, res) => {
      const end = Number(/^bytes=0-(\d+)$/.exec(String(req.headers['range']))?.[1]);
      const body = WHOLE.subarray(0, end + 1);
      res.writeHead(206, {
        'Content-Length': String(body.length),
        'Content-Range': `bytes 0-${body.length - 1}/${WHOLE.length}`,
      });
      res.end(body);
    });
    expect((await adapter(url).getObject('k', 10))?.toString()).toBe('0123456789');
  });

  it('an answer that ignores the range and declares more than the limit is refused before its body is read', async () => {
    let dropped!: () => void;
    const connectionDropped = new Promise<void>((resolve) => (dropped = resolve));
    const url = await standIn((_req, res) => {
      res.on('close', () => dropped());
      // 8 GiB is only declared; ten bytes are all that is ever sent, fewer than the limit.
      res.writeHead(200, { 'Content-Length': String(8 * 1024 ** 3) });
      res.write(WHOLE.subarray(0, 10));
    });

    const outcome = await within(
      5000,
      adapter(url).getObject('k', 100).then(
        () => 'returned',
        (e: Error) => e,
      ),
    );
    expect(outcome).toBeInstanceOf(RangeError);
    expect(await within(5000, connectionDropped)).not.toBe('timed out');
  });

  it('an answer with no declared length is counted while it is read and dropped past the limit', async () => {
    let dropped!: () => void;
    const connectionDropped = new Promise<void>((resolve) => (dropped = resolve));
    let sent = 0;
    const ceiling = 8 * 1024 * 1024; // the stand-in itself never sends more than this
    const url = await standIn((_req, res) => {
      res.on('close', () => dropped());
      res.writeHead(200); // no Content-Length: chunked
      const chunk = Buffer.alloc(64 * 1024);
      const pump = (): void => {
        while (!res.destroyed && sent < ceiling) {
          sent += chunk.length;
          if (!res.write(chunk)) {
            res.once('drain', pump);
            return;
          }
        }
        if (!res.destroyed) res.end();
      };
      pump();
    });

    const outcome = await within(
      5000,
      adapter(url).getObject('k', 100 * 1024).then(
        () => 'returned',
        (e: Error) => e,
      ),
    );
    expect(outcome).toBeInstanceOf(RangeError);
    expect(await within(5000, connectionDropped)).not.toBe('timed out');
    expect(sent).toBeLessThan(ceiling);
  });

  it('a limit that is not a positive integer is refused before any request is sent', async () => {
    let requests = 0;
    const url = await standIn((_req, res) => {
      requests += 1;
      res.writeHead(200, { 'Content-Length': '3' });
      res.end('abc');
    });

    for (const bad of [0, -5, 1.5, Number.NaN]) {
      await expect(adapter(url).getObject('k', bad)).rejects.toThrow(RangeError);
    }
    expect(requests).toBe(0);
  });

  // A partial answer that carries the checksum of the WHOLE object.
  const withWholeObjectChecksum: Handler = (_req, res) => {
    const body = WHOLE.subarray(0, 10);
    res.writeHead(206, {
      'Content-Length': String(body.length),
      'Content-Range': `bytes 0-9/${WHOLE.length}`,
      'x-amz-checksum-crc32': 'AAAAAA==', // the checksum of some other, whole object
    });
    res.end(body);
  };

  it('a partial answer that carries a whole-object checksum is read by the evidence client, which does not validate it', async () => {
    const url = await standIn(withWholeObjectChecksum);

    expect((await adapter(url).getObject('k', 10))?.toString()).toBe('0123456789');
    // The SDK default validates that header against the partial body, which is why the option exists.
    await expect(adapter(url, {}).getObject('k', 10)).rejects.toThrow(/checksum/i);
  });

  it('the API binds its evidence store with those client options', async () => {
    const url = await standIn(withWholeObjectChecksum);
    const names = [
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_MEDIA_BUCKET',
      'R2_EVIDENCE_BUCKET',
      'R2_MEDIA_PUBLIC_ORIGIN',
    ];
    const saved = names.map((n) => process.env[n]);
    Object.assign(process.env, {
      R2_ACCOUNT_ID: url,
      R2_ACCESS_KEY_ID: 'k',
      R2_SECRET_ACCESS_KEY: 's',
      R2_MEDIA_BUCKET: 'media',
      R2_EVIDENCE_BUCKET: 'evidence',
      R2_MEDIA_PUBLIC_ORIGIN: 'http://127.0.0.1/media',
    });
    try {
      const providers = Reflect.getMetadata('providers', AppModule) as Array<{
        provide?: unknown;
        useFactory?: () => unknown;
      }>;
      const binding = providers.find((p) => p.provide === FINANCIAL_STORAGE_ADAPTER);
      const evidence = binding?.useFactory?.() as FinancialStorageAdapter;
      expect((await evidence.getObject('k', 10))?.toString()).toBe('0123456789');
    } finally {
      names.forEach((n, i) => {
        const value = saved[i];
        if (value === undefined) delete process.env[n];
        else process.env[n] = value;
      });
    }
  });

  it('a store that never answers is given up on instead of holding the request open', async () => {
    const url = await standIn(() => {
      // accepts the request and never answers
    });
    // Covers a stall before any response headers only: a body that stalls after the headers is not
    // bounded (see StorageClientOptions). The SDK arms the socket timeout 3 s after the request
    // starts and retries a timed-out request twice.
    const outcome = await within(
      40_000,
      adapter(url, { stallTimeoutMs: 6_001 }).getObject('k', 10).then(
        () => 'answered',
        (e: Error) => e.name,
      ),
    );
    expect(outcome).toBe('TimeoutError');
  }, 60_000);
});
