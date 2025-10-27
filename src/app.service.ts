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
	private readonly documentationUrl = 'https://github.com/rhughes42/legal-eagle'
	private readonly graphqlPath = '/graphql'
	private readonly serviceName = 'legal-eagle API'

	getOverview(): ApiOverview {
		return {
			service: this.serviceName,
			status: 'ok',
			message: 'Welcome to the legal-eagle backend. Use the GraphQL endpoint for document operations.',
			graphqlEndpoint: this.graphqlPath,
			documentation: this.documentationUrl,
			timestamp: new Date().toISOString(),
		}
	}
}
