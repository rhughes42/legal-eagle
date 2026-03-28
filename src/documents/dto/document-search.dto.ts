import { Field, InputType, Int, ObjectType } from '@nestjs/graphql'
import { GraphQLISODateTime } from '@nestjs/graphql'
import { DocumentType } from '../document.model'

@InputType()
export class DocumentSearchFilterInput {
	@Field({ nullable: true })
	query?: string

	@Field({ nullable: true })
	caseType?: string

	@Field({ nullable: true })
	area?: string

	@Field({ nullable: true })
	court?: string

	@Field(() => GraphQLISODateTime, { nullable: true })
	dateFrom?: Date

	@Field(() => GraphQLISODateTime, { nullable: true })
	dateTo?: Date

	@Field({ nullable: true })
	hasSummary?: boolean

	@Field({ nullable: true })
	hasMetadata?: boolean
}

@ObjectType()
export class FacetBucket {
	@Field()
	key!: string

	@Field(() => Int)
	count!: number
}

@ObjectType()
export class DocumentSearchResult {
	@Field(() => [DocumentType])
	items!: DocumentType[]

	@Field(() => Int)
	total!: number

	@Field(() => [FacetBucket])
	caseTypeFacets!: FacetBucket[]

	@Field(() => [FacetBucket])
	areaFacets!: FacetBucket[]

	@Field(() => [FacetBucket])
	courtFacets!: FacetBucket[]
}
