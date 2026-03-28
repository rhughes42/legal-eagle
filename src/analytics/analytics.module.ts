import { Module } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AnalyticsService } from './analytics/analytics.service'
import { AnalyticsResolver } from './analytics/analytics.resolver'

@Module({
	providers: [AnalyticsService, AnalyticsResolver, PrismaService],
})
export class AnalyticsModule {}
