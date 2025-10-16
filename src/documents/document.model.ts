import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DocumentType {
	@Field(() => ID)
	id!: string;

	@Field()
	title!: string;

	@Field()
	content!: string;

	@Field({ nullable: true })
	sourceUrl?: string | null;

	@Field(() => GraphQLISODateTime)
	createdAt!: Date;

	@Field(() => GraphQLISODateTime)
	updatedAt!: Date;
}
