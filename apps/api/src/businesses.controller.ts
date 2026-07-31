import {
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { BusinessesService } from './businesses.service';

@Controller('businesses')
export class BusinessesController {
  constructor(@Inject(BusinessesService) private readonly service: BusinessesService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('city') city?: string,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
    @Query('dataQualityGrade') dataQualityGrade?: string,
    @Query('q') q?: string,
    @Query('minWebsiteHealth') minWebsiteHealth?: string,
    @Query('minSalesOpportunity') minSalesOpportunity?: string,
    @Query('minContactConfidence') minContactConfidence?: string,
    @Query('sort') sort?: string,
  ) {
    return this.service.list({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 25,
      city,
      category,
      priority,
      dataQualityGrade,
      q,
      minWebsiteHealth: minWebsiteHealth ? Number(minWebsiteHealth) : undefined,
      minSalesOpportunity: minSalesOpportunity ? Number(minSalesOpportunity) : undefined,
      minContactConfidence: minContactConfidence ? Number(minContactConfidence) : undefined,
      sort,
    });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const business = await this.service.get(id);
    if (!business) throw new NotFoundException('Business not found');
    return business;
  }

  @Get(':id/contacts')
  contacts(@Param('id') id: string) {
    return this.service.contacts(id);
  }

  @Get(':id/audits')
  audits(@Param('id') id: string) {
    return this.service.audits(id);
  }

  @Get(':id/evidence')
  evidence(@Param('id') id: string) {
    return this.service.evidence(id);
  }

  @Post(':id/re-audit')
  reAudit(@Param('id') id: string) {
    return this.service.reAudit(id);
  }
}
