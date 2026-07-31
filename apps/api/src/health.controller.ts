import { Controller, Get } from '@nestjs/common';
import { mongoose } from '@leadintel/database';

@Controller('health')
export class HealthController {
  @Get()
  async getHealth() {
    let database: 'ok' | 'error' = 'ok';
    let databaseError: string | undefined;
    try {
      const state = mongoose.connection.readyState;
      if (state !== 1) {
        database = 'error';
        databaseError = `mongoose readyState=${state}`;
      } else {
        await mongoose.connection.db?.admin().ping();
      }
    } catch (err) {
      database = 'error';
      databaseError = err instanceof Error ? err.message : String(err);
    }

    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      service: 'leadintel-api',
      database,
      databaseError,
      queue: 'mongodb',
      ts: new Date().toISOString(),
    };
  }
}
