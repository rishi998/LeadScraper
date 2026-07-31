import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { exportCreateSchema } from '@leadintel/shared';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'node:fs';
import { ExportsService } from './exports.service';
import { resolveExportFilePath } from './export-paths';

@Controller('exports')
export class ExportsController {
  constructor(@Inject(ExportsService) private readonly service: ExportsService) {}

  @Post()
  async create(@Body() body: unknown) {
    const parsed = exportCreateSchema.safeParse(body ?? {});
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.service.create(parsed.data);
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const run = await this.service.get(id);
    if (!run) throw new NotFoundException('Export not found');
    return run;
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() res: Response) {
    const run = await this.service.get(id);
    const absolute = run?.filePath ? resolveExportFilePath(run.filePath) : null;
    if (!absolute || !existsSync(absolute)) {
      throw new NotFoundException('Export file not ready');
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="leadintel-${id}.xlsx"`);
    createReadStream(absolute).pipe(res);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
