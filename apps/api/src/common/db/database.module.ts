import { Global, Module, type OnModuleDestroy, Inject } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Pool } from 'pg';
import { createAppPool, createDatabase, createFinancialPool } from './database';
import type { Database } from './database.types';

/** Injection token for the application-pool Kysely instance. */
export const APP_DATABASE = Symbol('APP_DATABASE');

/**
 * The AUDIT boundary (section 6.2): the ONLY pool permitted to call the
 * decrypting functions. Same role, second pool — grep this token's
 * importers and you hold the complete list of code that can reach payment
 * evidence and payout credentials. Tier 6 made it real.
 */
export const FINANCIAL_DATABASE = Symbol('FINANCIAL_DATABASE');

/**
 * Owns the connection pool's lifecycle.
 *
 * A pool constructed inline in a controller never gets closed, which leaks a
 * connection per instantiation and leaves Jest workers hanging. More
 * importantly it makes the connection budget unknowable, and ADU-CON-02 v3.0
 * section 17 budgets connections explicitly: ~30 direct at 10,000 sellers
 * against a plan limit of 100, with PgBouncer transaction mode as the action at
 * >=70. Pools must therefore be created in exactly one place and counted.
 *
 * TIER 0 — only the app pool is provided. The `financial` pool of section 6.2
 * is created here too when the first module that may call the decrypting
 * functions is built (Tier 6), so that grepping its injection token still
 * yields the complete list of code that can reach payment evidence.
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_DATABASE,
      useFactory: (): Kysely<Database> => {
        const connectionString = process.env['DATABASE_URL'] ?? '';
        return createDatabase(createAppPool(connectionString));
      },
    },
    {
      provide: FINANCIAL_DATABASE,
      useFactory: (): Kysely<Database> => {
        const connectionString = process.env['DATABASE_URL'] ?? '';
        return createDatabase(createFinancialPool(connectionString));
      },
    },
  ],
  exports: [APP_DATABASE, FINANCIAL_DATABASE],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(
    @Inject(APP_DATABASE) private readonly db: Kysely<Database>,
    @Inject(FINANCIAL_DATABASE) private readonly financialDb: Kysely<Database>,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.db.destroy();
    await this.financialDb.destroy();
  }
}

export type { Pool };
