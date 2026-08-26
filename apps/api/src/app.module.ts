import { Module } from '@nestjs/common';
import { DatabaseModule } from './common/db/database.module';
import { HealthController } from './health.controller';

/**
 * TIER 0 — one controller, one infrastructure module, no business logic.
 *
 * The nineteen module folders under src/modules hold a README each and nothing
 * else. They are registered here as they are built, from Tier 3 onward
 * (ADU-CON-02 v3.0 section 15). Tier 3 before Tier 4 is not negotiable.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
})
export class AppModule {}
