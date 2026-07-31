import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { searchJobCreateSchema } from '@leadintel/shared';
import { SearchJobsService } from './search-jobs.service';

@Controller('search-jobs')
export class SearchJobsController {
  constructor(@Inject(SearchJobsService) private readonly service: SearchJobsService) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = searchJobCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.create(parsed.data);
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const job = await this.service.get(id);
    if (!job) throw new NotFoundException('Search job not found');
    return job;
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.service.start(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
