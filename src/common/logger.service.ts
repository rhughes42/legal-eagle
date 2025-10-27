/* eslint-disable @typescript-eslint/no-unsafe-call */ /* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, LoggerService } from '@nestjs/common'
import * as baseLogger from './logger'

@Injectable()
export class AppLogger implements LoggerService {
    log(message: string, ...optionalParams: unknown[]): void {
        try {
            baseLogger.LogInfo(message, optionalParams.length ? optionalParams : undefined)
        } catch {
            // fallback
            // eslint-disable-next-line no-console
            console.log(message, ...optionalParams)
        }
    }

    error(message: string, trace?: string, ...optionalParams: unknown[]): void {
        try {
            baseLogger.LogError(message, { trace, params: optionalParams.length ? optionalParams : undefined })
        } catch {
            // eslint-disable-next-line no-console
            console.error(message, trace, ...optionalParams)
        }
    }

    warn(message: string, ...optionalParams: unknown[]): void {
        try {
            baseLogger.LogWarning(message, optionalParams.length ? optionalParams : undefined)
        } catch {
            // eslint-disable-next-line no-console
            console.warn(message, ...optionalParams)
        }
    }

    debug?(message: string, ...optionalParams: unknown[]): void {
        try {
            baseLogger.LogDebug(message, optionalParams.length ? optionalParams : undefined)
        } catch {
            // eslint-disable-next-line no-console
            console.debug(message, ...optionalParams)
        }
    }

    verbose?(message: string, ...optionalParams: unknown[]): void {
        try {
            baseLogger.LogTrace(message, optionalParams.length ? optionalParams : undefined)
        } catch {
            // eslint-disable-next-line no-console
            console.log(message, ...optionalParams)
        }
    }
}

export default AppLogger
