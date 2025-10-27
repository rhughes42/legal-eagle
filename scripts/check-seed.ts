import { PrismaClient } from '@prisma/client'
import { LogInfo, LogError } from '../src/common/logger'

/**
 * Main entrypoint that verifies whether the database has been seeded with any documents.
 *
 * This function:
 * - Instantiates a new PrismaClient.
 * - Counts rows in the `document` table.
 * - Logs the document count using `LogInfo`.
 * - Exits the process with:
 *   - 0 if at least one document exists,
 *   - 2 if no documents were found,
 *   - 1 if an error occurred while counting.
 * - Ensures an attempt is made to disconnect the Prisma client in a `finally` block.
 *
 * Notes:
 * - This function has side effects: it calls `process.exit(...)` and uses global logging helpers
 *   (`LogInfo`, `LogError`), so it is intended to be used as a CLI/entrypoint routine.
 * - Because the function calls `process.exit`, the process may terminate before asynchronous
 *   cleanup (such as awaiting `$disconnect`) completes; therefore cleanup is attempted but not
 *   guaranteed to finish if `process.exit` is invoked.
 * - If `prisma.$disconnect()` rejects, that rejection may propagate from this async function.
 *
 * @returns A Promise that resolves to void. Under normal operation the process will exit with
 *          an appropriate exit code rather than relying on the returned Promise.
 */
async function main(): Promise<void> {
    const prisma = new PrismaClient()
    try {
        const count = await prisma.document.count()
        LogInfo('ℹ️ document_count: ' + String(count))
        if (count && count > 0) {
            LogInfo(`✅ Seed check passed. ${count} documents found.`)
            process.exit(0)
        } else {
            LogError('❌ Seed check failed: No documents found!')
            process.exit(2)
        }
    } catch (err) {
        LogError('❌ Seed check error: ' + String(err))
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

void main()
