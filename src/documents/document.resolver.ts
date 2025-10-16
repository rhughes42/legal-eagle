import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentType } from './document.model';

@Resolver(() => DocumentType)
export class DocumentResolver {
	constructor(private readonly prisma: PrismaService) {}

	@Query(() => [DocumentType], { name: 'documents' })
	async documents(): Promise<DocumentType[]> {
		return this.prisma.document.findMany();
	}

	@Query(() => DocumentType, { name: 'document', nullable: true })
	async document(
		@Args('id', { type: () => ID }) id: string,
	): Promise<DocumentType | null> {
		return this.prisma.document.findUnique({ where: { id } });
	}
}
