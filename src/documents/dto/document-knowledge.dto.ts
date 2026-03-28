import { Field, Float, InputType, Int, ObjectType } from '@nestjs/graphql'
import { GraphQLISODateTime } from '@nestjs/graphql'
import { DocumentType } from '../document.model'

@ObjectType()
export class DocumentSegmentType {
	@Field(() => Int)
	id!: number

	@Field(() => String, { nullable: true })
	title!: string | null

	@Field(() => String)
	content!: string

	@Field(() => Int, { nullable: true })
	tokenCount!: number | null

	@Field(() => Int)
	position!: number

	@Field(() => GraphQLISODateTime)
	createdAt!: Date
}

@ObjectType()
export class DocumentRelationType {
	@Field(() => Int)
	id!: number

	@Field(() => Int)
	sourceId!: number

	@Field(() => Int)
	targetId!: number

	@Field(() => String)
	relationType!: string

	@Field(() => String, { nullable: true })
	description!: string | null

	@Field(() => GraphQLISODateTime)
	createdAt!: Date
}

@InputType()
export class CreateRelationInput {
	@Field(() => Int)
	sourceId!: number

	@Field(() => Int)
	targetId!: number

	@Field(() => String)
	relationType!: string

	@Field(() => String, { nullable: true })
	description?: string
}

@ObjectType()
export class SimilarDocumentType {
	@Field(() => DocumentType)
	document!: DocumentType

	@Field(() => Float)
	score!: number
}
