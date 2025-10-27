/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * TypeScript implementation of a small app logger.
 * Exports named functions: LogInfo, LogMessage, LogError, LogWarning, LogDebug, LogTrace
 */
import util from 'util'

// Define Meta as an alias for unknown type
type Meta = unknown

// Numeric log levels
const LEVELS: Record<string, number> = {
	error: 40,
	warn: 30,
	info: 20,
	debug: 10,
	trace: 5,
}

// ANSI color escape sequences for log levels
const COLORS = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	yellow: '\x1b[33m',
	green: '\x1b[32m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
}

// Reads and returns the configured log level from environment variables.
function getConfiguredLevel(): number {
	const raw = (process.env.LOG_LEVEL || 'info').toLowerCase()
	return LEVELS[raw] != null ? LEVELS[raw] : LEVELS.info
}

// Cached configured log level for performance
const CONFIG_LEVEL = getConfiguredLevel()

// Generates an ISO 8601 timestamp string for log entries.
function timestamp(): string {
	return new Date().toISOString()
}

// Formats the metadata object into a string for logging.
function formatMeta(meta: Meta): string {
	if (meta == null) return ''
	if (typeof meta === 'string') return meta
	try {
		return util.inspect(meta, { colors: false, depth: 6 })
	} catch (e) {
		return String(meta)
	}
}

// Determines if a log at the given level should be emitted based on the configured level.
function shouldLog(level: number): boolean {
	return level >= CONFIG_LEVEL
}

/**
 * Outputs a formatted log message to the console if the resolved log level is enabled.
 *
 * The function resolves the numeric log level using LEVELS[levelName]; if that lookup fails,
 * the info level (LEVELS.info) is used as a fallback. If the resolved level is not enabled
 * according to shouldLog(level), the function returns early and does not write anything.
 *
 * When logging, a timestamp is obtained from timestamp() and optional metadata is serialized
 * via formatMeta(meta). A color escape sequence is selected from COLORS using the provided
 * color key; if the key is not found an empty string is used. The prefixed header contains
 * the timestamp, the upper-cased level name, and the reset color sequence (COLORS.reset).
 * If metadata is present, it is appended to the message separated by " - ".
 *
 * Side effects:
 * - Writes a single line to the console via console.log.
 *
 * @param levelName - The textual name of the log level (e.g., "info", "warn", "error").
 *                    This is looked up in LEVELS to determine the numeric level.
 * @param color - A key of the COLORS object used to select a color escape sequence for the
 *                log prefix. If the key is not present in COLORS, no color sequence is used.
 * @param message - The primary log message text to be written.
 * @param meta - Optional metadata object; when provided it is formatted and appended to the
 *               message after a separator (" - ").
 *
 * @returns void
 *
 * @remarks
 * This function is synchronous and does not throw under normal operation. It relies on the
 * external utilities and constants: LEVELS, shouldLog, timestamp, formatMeta, and COLORS.
 *
 * @example
 * // Log an info message in green with metadata
 * output("info", "green", "User created", { id: 123, name: "Alice" });
 */
function output(levelName: string, color: keyof typeof COLORS, message: string, meta?: Meta): void {
	const level = LEVELS[levelName] ?? LEVELS.info // Set the level, default to info if unknown.

	if (!shouldLog(level)) return // Early exit if level is not enabled.

	const ts = timestamp() // Get the current timestamp.
	const metaStr = formatMeta(meta) // Format the metadata if provided.
	const prefix = `${COLORS[color] || ''}[${ts}] [${levelName.toUpperCase()}]${COLORS.reset}` // Construct the log prefix.

	if (metaStr) {
		console.log(`${prefix} ${message} - ${metaStr}`)
	} else {
		console.log(`${prefix} ${message}`)
	}
}

/**
 * Log an informational message.
 *
 * Sends the provided message and optional metadata to the logging backend at the "info" level.
 * The entry is emitted using the shared output mechanism with a "green" style.
 *
 * @param message - The message to log.
 * @param meta - Optional metadata object containing additional contextual information.
 * @returns void
 */
export function LogInfo(message: string, meta?: Meta): void {
	output('info', 'green', message, meta)
}

export function LogMessage(message: string, meta?: Meta): void {
	output('info', 'green', message, meta)
}

/**
 * Logs a warning-level message.
 *
 * Forwards the provided message and optional metadata to the internal
 * logging facility using the 'warn' level and 'yellow' color.
 *
 * @param message - The warning message to log.
 * @param meta - Optional metadata to include with the log entry.
 * @returns void
 */
export function LogWarning(message: string, meta?: Meta): void {
	output('warn', 'yellow', message, meta)
}

/**
 * Logs an error-level message to the application's logging output.
 *
 * Writes a message with the "error" severity (rendered in red) to the centralized logger.
 * Use this for operational errors or unexpected conditions that should be visible in logs.
 *
 * @param message - The error message to log.
 * @param meta - Optional additional metadata to attach to the log entry (e.g., error objects, request identifiers, context).
 * @returns void
 *
 * @example
 * LogError('Failed to save user profile', { userId, error });
 */
export function LogError(message: string, meta?: Meta): void {
	output('error', 'red', message, meta)
}

/**
 * Logs a debug-level message.
 *
 * Emits a debug message styled with cyan color. Accepts a message string
 * and optional metadata for additional context.
 *
 * @param message - The debug message to log.
 * @param meta - Optional metadata or contextual information to attach to the log.
 * @returns void
 */
export function LogDebug(message: string, meta?: Meta): void {
	output('debug', 'cyan', message, meta)
}

/**
 * Logs a trace-level message.
 *
 * Records a very verbose, low-level diagnostic message for debugging purposes.
 * Accepts a plain message and an optional metadata object that will be included
 * with the log entry.
 *
 * @param message - The message to log.
 * @param meta - Optional metadata or contextual information to attach to the log.
 * @returns void
 *
 * @remarks
 * This function emits a "trace" level log entry (styled with magenta) via the
 * internal output mechanism. Trace logs are typically used during development
 * or detailed troubleshooting and may be disabled in production environments.
 *
 * @example
 * LogTrace('Starting background sync', { attempt: 1, source: 'syncService' });
 */
export function LogTrace(message: string, meta?: Meta): void {
	output('trace', 'magenta', message, meta)
}

export default {
	LogInfo,
	LogMessage,
	LogWarning,
	LogError,
	LogDebug,
	LogTrace,
}
