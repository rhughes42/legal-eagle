import { Field, Int, ObjectType } from '@nestjs/graphql'
import { GraphQLISODateTime } from '@nestjs/graphql'

@ObjectType()
export class KeyBucket {
	@Field()
	key!: string

	@Field(() => Int)
	count!: number
}

@ObjectType()
export class TimeBucket {
	@Field(() => GraphQLISODateTime)
	period!: Date

	@Field(() => Int)
	count!: number
}

@ObjectType()
export class AnalyticsSnapshot {
	@Field(() => Int)
	totalDocuments!: number

	@Field(() => Int)
	documentsWithSummary!: number

	@Field(() => Int)
	documentsWithMetadata!: number

	@Field(() => Int)
	relationCount!: number

	@Field(() => Int)
	segmentCount!: number

	@Field(() => GraphQLISODateTime, { nullable: true })
	newestDocument!: Date | null

	@Field(() => [KeyBucket])
	topAreas!: KeyBucket[]

	@Field(() => [KeyBucket])
	topCaseTypes!: KeyBucket[]

	@Field(() => [KeyBucket])
	topCourts!: KeyBucket[]

	@Field(() => [TimeBucket])
	monthlyTrend!: TimeBucket[]
}
