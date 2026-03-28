import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { AnalyticsSnapshot, KeyBucket, TimeBucket } from '../dto/analytics.dto'

@Injectable()
export class AnalyticsService {
	constructor(private readonly prisma: PrismaService) {}

	async snapshot(): Promise<AnalyticsSnapshot> {
		const [totalDocuments, documentsWithSummary, documentsWithMetadata, relationCount, segmentCount, newest] = await Promise.all([
			this.prisma.document.count(),
			this.prisma.document.count({ where: { summary: { not: null } } }),
			this.prisma.document.count({ where: { metadata: { not: Prisma.DbNull } } }),
			this.prisma.documentRelation.count(),
			this.prisma.documentSegment.count(),
			this.prisma.document.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
		])

		const [topAreas, topCaseTypes, topCourts, monthlyTrend] = await Promise.all([
			this.facet('area'),
			this.facet('caseType'),
			this.facet('court'),
			this.monthlyTrend(),
		])

		return {
			totalDocuments,
			documentsWithSummary,
			documentsWithMetadata,
			relationCount,
			segmentCount,
			newestDocument: newest?.createdAt ?? null,
			topAreas,
			topCaseTypes,
			topCourts,
			monthlyTrend,
		}
	}

	private async facet(field: 'area' | 'caseType' | 'court'): Promise<KeyBucket[]> {
		const rows = await this.prisma.document.groupBy({
			by: [field],
			where: { [field]: { not: null } },
			_count: { id: true },
			orderBy: { _count: { id: 'desc' } },
			take: 6,
		})

		return rows.reduce<KeyBucket[]>((acc, row) => {
			const key = row[field]
			if (typeof key === 'string') {
				acc.push({ key, count: Number(row._count?.id ?? 0) })
			}
			return acc
		}, [])
	}

	private async monthlyTrend(): Promise<TimeBucket[]> {
		const rows = await this.prisma.$queryRaw<Array<{ period: Date; count: bigint }>>(Prisma.sql`
			SELECT DATE_TRUNC('month', "createdAt") AS period, COUNT(*)::bigint AS count
			FROM "Document"
			GROUP BY period
			ORDER BY period DESC
			LIMIT 12
		`)

		return rows
			.map((row) => ({
				period: row.period,
				count: typeof row.count === 'number' ? row.count : Number(row.count),
			}))
			.sort((a, b) => a.period.getTime() - b.period.getTime())
	}
}
