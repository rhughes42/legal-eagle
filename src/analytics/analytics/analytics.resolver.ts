import { Query, Resolver } from '@nestjs/graphql'
import { AnalyticsSnapshot } from '../dto/analytics.dto'
import { AnalyticsService } from './analytics.service'

@Resolver(() => AnalyticsSnapshot)
export class AnalyticsResolver {
	constructor(private readonly analyticsService: AnalyticsService) {}

	@Query(() => AnalyticsSnapshot, { name: 'documentAnalytics' })
	async documentAnalytics(): Promise<AnalyticsSnapshot> {
		return this.analyticsService.snapshot()
	}
}
