import { Global, Module } from '@nestjs/common';
import { MongoJobQueue, type JobQueue } from '@leadintel/job-queue';
import { WORKER_DEFAULTS } from '@leadintel/shared';
import { SearchJobsController } from './search-jobs.controller';
import { BusinessesController } from './businesses.controller';
import { ExportsController } from './exports.controller';
import { HealthController } from './health.controller';
import { DashboardController } from './dashboard.controller';
import { SearchJobsService } from './search-jobs.service';
import { BusinessesService } from './businesses.service';
import { ExportsService } from './exports.service';
import { JOB_QUEUE } from './tokens';

@Global()
@Module({
  controllers: [
    HealthController,
    DashboardController,
    SearchJobsController,
    BusinessesController,
    ExportsController,
  ],
  providers: [
    {
      provide: JOB_QUEUE,
      useFactory: (): JobQueue =>
        new MongoJobQueue({
          maxAttempts: Number(process.env.WORKER_MAX_ATTEMPTS ?? WORKER_DEFAULTS.maxAttempts),
        }),
    },
    SearchJobsService,
    BusinessesService,
    ExportsService,
  ],
  exports: [JOB_QUEUE],
})
export class AppModule {}
