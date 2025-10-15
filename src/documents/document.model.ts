import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Document {
	@Field(() => ID)
	id!: string;

	@Field()
	title!: string;

	@Field()
	content!: string;

	@Field({ nullable: true })
	sourceUrl?: string | null;

	@Field()
	createdAt!: Date;

	@Field()
	updatedAt!: Date;
}
