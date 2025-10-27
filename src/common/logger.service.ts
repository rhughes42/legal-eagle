import { Injectable, LoggerService } from '@nestjs/common'
import * as baseLogger from './logger'

/**
 * AppLogger is a thin wrapper around an underlying `baseLogger` that implements
 * NestJS's `LoggerService` interface. It delegates logging operations to the
 * underlying logger and provides a safe fallback to the console if the
 * underlying logger throws.
 *
 * Behavior:
 * - Attempts to call the corresponding `baseLogger` method (LogInfo, LogError,
 *   LogWarning, LogDebug, LogTrace).
 * - If the underlying call throws, the logger will catch the error and emit
 *   the message using the appropriate `console` method as a default fallback.
 *
 * This ensures application logging continues even if the external logger fails.
 */
@Injectable()
export class AppLogger implements LoggerService {
	// Log a standard informational message.
	log(message: string, ...optionalParams: unknown[]): void {
		try {
			baseLogger.LogInfo(message, optionalParams.length ? optionalParams : undefined)
		} catch {
			// Default fallback

			console.log(message, ...optionalParams)
		}
	}

	// Log an error message with optional stack trace and parameters.
	error(message: string, trace?: string, ...optionalParams: unknown[]): void {
		try {
			baseLogger.LogError(message, { trace, params: optionalParams.length ? optionalParams : undefined })
		} catch {
			console.error(message, trace, ...optionalParams)
		}
	}

	// Log a warning message with optional parameters.
	warn(message: string, ...optionalParams: unknown[]): void {
		try {
			baseLogger.LogWarning(message, optionalParams.length ? optionalParams : undefined)
		} catch {
			console.warn(message, ...optionalParams)
		}
	}

	// Log a debug-level message with optional parameters.
	debug?(message: string, ...optionalParams: unknown[]): void {
		try {
			baseLogger.LogDebug(message, optionalParams.length ? optionalParams : undefined)
		} catch {
			console.debug(message, ...optionalParams)
		}
	}

	// Log a trace-level message with optional parameters.
	verbose?(message: string, ...optionalParams: unknown[]): void {
		try {
			baseLogger.LogTrace(message, optionalParams.length ? optionalParams : undefined)
		} catch {
			console.log(message, ...optionalParams)
		}
	}
}

export default AppLogger
