// Shim loader so CommonJS scripts can continue to require the logger.
// This registers ts-node so requiring the .ts file works at runtime (dev).
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('ts-node').register({ transpileOnly: true })
} catch (e) {
    // ts-node may not be available in production builds; ignore if absent
}

module.exports = require('./logger.ts')
/**
 * Simple reusable logger used across the application.
 * - Exports helpers: LogInfo, LogMessage, LogError, LogWarning, LogDebug
 * - Honors LOG_LEVEL env var (error,warn,info,debug,trace)
 * - Uses console and adds timestamps and levels. Works in Node (CommonJS).
 */

const util = require('util')

const LEVELS = {
    error: 40,
    warn: 30,
    info: 20,
    debug: 10,
    trace: 5,
}

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
}

function getConfiguredLevel() {
    const raw = (process.env.LOG_LEVEL || 'info').toLowerCase()
    return LEVELS[raw] != null ? LEVELS[raw] : LEVELS.info
}

const CONFIG_LEVEL = getConfiguredLevel()

function timestamp() {
    return new Date().toISOString()
}

function formatMeta(meta) {
    if (meta == null) return ''
    if (typeof meta === 'string') return meta
    try {
        return util.inspect(meta, { colors: false, depth: 6 })
    } catch (e) {
        return String(meta)
    }
}

function shouldLog(level) {
    return level >= CONFIG_LEVEL
}

function output(levelName, color, message, meta) {
    const level = LEVELS[levelName] || LEVELS.info
    if (!shouldLog(level)) return
    const ts = timestamp()
    const metaStr = formatMeta(meta)
    const prefix = `${COLORS[color] || ''}[${ts}] [${levelName.toUpperCase()}]${COLORS.reset}`
    if (metaStr) {
        console.log(`${prefix} ${message} - ${metaStr}`)
    } else {
        console.log(`${prefix} ${message}`)
    }
}

function LogInfo(message, meta) {
    output('info', 'green', message, meta)
}

function LogMessage(message, meta) {
    // Alias for info; preserved for callers who prefer LogMessage
    output('info', 'green', message, meta)
}

function LogWarning(message, meta) {
    output('warn', 'yellow', message, meta)
}

function LogError(message, meta) {
    output('error', 'red', message, meta)
}

function LogDebug(message, meta) {
    output('debug', 'cyan', message, meta)
}

function LogTrace(message, meta) {
    output('trace', 'magenta', message, meta)
}

module.exports = {
    LogInfo,
    LogMessage,
    LogWarning,
    LogError,
    LogDebug,
    LogTrace,
}
