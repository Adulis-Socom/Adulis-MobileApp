import { Controller, Get, Inject, Res, type BeforeApplicationShutdown } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import { Public } from './platform/auth';

export const PG_POOL = Symbol('PG_POOL');
const READINESS_TIMEOUT_MS = 2_000;
const statusSchema = (value: string) => ({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: [value] } } });

/**
 * DEPLOY-01 S30-S31: minimal unauthenticated liveness and readiness. Readiness is PostgreSQL accepting
 * canonical writes (reachable, not a read-only standby) and the process not draining. The rebuildable cache is
 * deliberately NOT a readiness input. No hostname, URL, schema or secret state ever appears in a response.
 */
@ApiTags('health')
@Controller()
export class HealthController implements BeforeApplicationShutdown {
  private draining = false;

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Public()
  @Get('livez')
  @ApiOkResponse({ description: 'The process is running.', schema: statusSchema('ok') })
  livez(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Public()
  @Get('healthz')
  @ApiOkResponse({ description: 'Ready to serve normal traffic.', schema: statusSchema('ok') })
  @ApiServiceUnavailableResponse({ description: 'Not ready: database unavailable or read-only, or draining.', schema: statusSchema('unavailable') })
  async healthz(@Res({ passthrough: true }) reply: FastifyReply): Promise<{ status: 'ok' | 'unavailable' }> {
    if (!this.draining && (await this.writable())) return { status: 'ok' };
    void reply.status(503);
    return { status: 'unavailable' };
  }

  beforeApplicationShutdown(): void {
    this.draining = true;
  }

  private async writable(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), READINESS_TIMEOUT_MS);
    });
    const probe = this.pool.query('select not pg_is_in_recovery() as writable').then(
      (r) => (r.rows[0] as { writable: boolean } | undefined)?.writable === true,
      () => false,
    );
    try {
      return await Promise.race([probe, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
