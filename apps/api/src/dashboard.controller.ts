import { Controller, Get } from '@nestjs/common';
import { BusinessModel, ContactModel, WebsiteModel } from '@leadintel/database';

@Controller('dashboard')
export class DashboardController {
  @Get('stats')
  async stats() {
    const [
      businessesDiscovered,
      verifiedWebsites,
      verifiedContacts,
      hotLeads,
      warmLeads,
      aggregates,
    ] = await Promise.all([
      BusinessModel.countDocuments(),
      WebsiteModel.countDocuments({
        verificationStatus: { $in: ['VERIFIED', 'LIKELY'] },
      }),
      ContactModel.countDocuments({
        isPrimary: true,
        verificationStatus: { $in: ['CONFIRMED', 'LIKELY'] },
      }),
      BusinessModel.countDocuments({ 'currentScores.priority': 'HOT' }),
      BusinessModel.countDocuments({ 'currentScores.priority': 'WARM' }),
      BusinessModel.aggregate([
        {
          $group: {
            _id: null,
            averageWebsiteHealth: { $avg: '$currentScores.websiteHealth' },
            averageOpportunityScore: { $avg: '$currentScores.salesOpportunity' },
          },
        },
      ]),
    ]);

    const agg = aggregates[0] as
      | { averageWebsiteHealth?: number; averageOpportunityScore?: number }
      | undefined;

    return {
      businessesDiscovered,
      verifiedWebsites,
      verifiedContacts,
      hotLeads,
      warmLeads,
      averageWebsiteHealth: agg?.averageWebsiteHealth ?? null,
      averageOpportunityScore: agg?.averageOpportunityScore ?? null,
    };
  }
}
