import { Injectable } from '@nestjs/common'

/**
 * Shape of the root health summary returned by the API.
 */
export interface ApiOverview {
	service: string
	status: 'ok'
	message: string
	graphqlEndpoint: string
	documentation: string
	timestamp: string
}

/**
 * Application-level service exposing a simple health summary for the root route.
 */
@Injectable()
export class AppService {
	private readonly documentationUrl = 'https://github.com/Pandektes/legal-eagle'
	private readonly graphqlPath = '/graphql'
	private readonly serviceName = 'Pandektes LegalEagle API'

	getOverview(): ApiOverview {
		return {
			service: this.serviceName,
			status: 'ok',
			message: 'Welcome to the Pandektes LegalEagle backend. Use the GraphQL endpoint for document operations.',
			graphqlEndpoint: this.graphqlPath,
			documentation: this.documentationUrl,
			timestamp: new Date().toISOString(),
		}
	}
}
