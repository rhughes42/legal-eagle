/**
 * TypeScript implementation of a small app logger.
 * Exports named functions: LogInfo, LogMessage, LogError, LogWarning, LogDebug, LogTrace
 */
import util from 'util'

type Meta = unknown

const LEVELS: Record<string, number> = {
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

function getConfiguredLevel(): number {
    const raw = (process.env.LOG_LEVEL || 'info').toLowerCase()
    return LEVELS[raw] != null ? LEVELS[raw] : LEVELS.info
}

const CONFIG_LEVEL = getConfiguredLevel()

function timestamp(): string {
    return new Date().toISOString()
}

function formatMeta(meta: Meta): string {
    if (meta == null) return ''
    if (typeof meta === 'string') return meta
    try {
        return util.inspect(meta, { colors: false, depth: 6 })
    } catch (e) {
        return String(meta)
    }
}

function shouldLog(level: number): boolean {
    return level >= CONFIG_LEVEL
}

function output(levelName: string, color: keyof typeof COLORS, message: string, meta?: Meta): void {
    const level = LEVELS[levelName] ?? LEVELS.info
    if (!shouldLog(level)) return
    const ts = timestamp()
    const metaStr = formatMeta(meta)
    const prefix = `${COLORS[color] || ''}[${ts}] [${levelName.toUpperCase()}]${COLORS.reset}`
    if (metaStr) console.log(`${prefix} ${message} - ${metaStr}`)
    else console.log(`${prefix} ${message}`)
}

export function LogInfo(message: string, meta?: Meta): void {
    output('info', 'green', message, meta)
}

export function LogMessage(message: string, meta?: Meta): void {
    output('info', 'green', message, meta)
}

export function LogWarning(message: string, meta?: Meta): void {
    output('warn', 'yellow', message, meta)
}

export function LogError(message: string, meta?: Meta): void {
    output('error', 'red', message, meta)
}

export function LogDebug(message: string, meta?: Meta): void {
    output('debug', 'cyan', message, meta)
}

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
