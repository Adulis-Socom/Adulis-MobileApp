import 'reflect-metadata';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { createApp } from '../app';
import { apiEnvSchema } from '../config/env';
import { createPool } from '../db/client';
import { createLogger } from '../platform/logging';
import { RebuildableCache } from '../platform/valkey';

export const CONTRACT_PATH = path.resolve(__dirname, '../../../../contracts/openapi.json');

/** Recursively sorts object keys so the document is byte-stable across runs and machines. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, sortKeys(v)]));
  }
  return value;
}

/**
 * Builds the contract from the decorators of the SAME application main.ts serves (ARC-BE-02/05). Nothing is
 * connected: the pool is never queried and the cache is absent. Only implemented routes appear; the legacy
 * contract is never copied (RB25-D01).
 */
export async function buildOpenApiDocument(): Promise<OpenAPIObject> {
  const logger = createLogger({ service: 'adulis-openapi', level: 'warn', release: 'openapi' });
  const env = apiEnvSchema.parse({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://openapi@127.0.0.1:55440/adulis_rebuild',
    CACHE_VALKEY_URL: 'redis://127.0.0.1:1',
    CONSOLE_ORIGIN: 'http://localhost:5173',
  });
  const app = await createApp({ env, logger, pool: createPool(env.DATABASE_URL, 'adulis-openapi', 1), cache: new RebuildableCache(null, logger) });
  await app.init();
  try {
    const config = new DocumentBuilder()
      .setTitle('Adulis API')
      .setDescription('Replacement lineage rebuild-20261125. Generated from apps/api; never hand-edited.')
      .setVersion('0.1.0')
      .build();
    return sortKeys(SwaggerModule.createDocument(app, config)) as OpenAPIObject;
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  buildOpenApiDocument().then(
    (doc) => {
      writeFileSync(CONTRACT_PATH, `${JSON.stringify(doc, null, 2)}\n`);
      process.stdout.write(`generate:openapi: wrote ${path.relative(process.cwd(), CONTRACT_PATH)}\n`);
    },
    (err: unknown) => {
      process.stderr.write(`generate:openapi: ${err instanceof Error ? err.message : 'failed'}\n`);
      process.exit(1);
    },
  );
}
