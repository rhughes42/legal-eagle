import { Query, Resolver } from '@nestjs/graphql';
import { Document } from './document.model';

@Resolver(() => Document)
export class DocumentResolver {
	// Step 2 stub: return no documents until persistence is added.
	@Query(() => [Document], { name: 'documents' })
	documents(): Document[] {
		return [];
	}
}
