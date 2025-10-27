import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import 'dotenv/config'
import { LogInfo, LogError, LogWarning } from '../src/common/logger'

const prisma = new PrismaClient()

/**
 * Seeds the database from a JSON or SQL seed file found relative to the script.
 *
 * Behavior summary:
 * - Looks for a JSON file at ../data/seed-documents.json (preferred) or a SQL file at ../seed-documents.sql (fallback).
 * - If a JSON file is found it must be an array of document objects. If a SQL file is found, its raw SQL will be executed.
 * - Supports three CLI modes controlled by flags:
 *   - Force: --force, --yes, -y  -> skip interactive confirmation and run immediately.
 *   - Dry-run: --dry-run, --dryrun -> print what would happen (sample record / SQL summary) and make no DB changes.
 *   - Upsert: --upsert, --upsert-by-filename -> for JSON input, update existing documents matched by fileName, otherwise create.
 * - Default behavior for JSON input: attempt a bulk insert via prisma.document.createMany({ data, skipDuplicates: true }) and,
 *   if that fails, fall back to per-item create with individual error handling.
 * - For SQL input, runs the SQL with prisma.$executeRawUnsafe(sql).
 * - Interactive mode: if running in a TTY and not forced, prompts the user to type "yes" to continue; otherwise aborts with guidance to use --force.
 *
 * Side effects:
 * - Reads from the file system (seed JSON/SQL files).
 * - Performs database operations via the global `prisma` client (createMany, create, findFirst, update, $executeRawUnsafe).
 * - Disconnects the prisma client on completion or error via prisma.$disconnect().
 * - May call process.exit(...) or set process.exitCode on fatal errors; logs errors and warnings to console.
 *
 * Error handling:
 * - Exits with code 1 when no seed file is found, when JSON parsing fails, or when non-interactive execution is attempted without --force.
 * - Many per-record DB errors are caught and logged as warnings so seeding can continue where possible.
 *
 * Important notes:
 * - JSON seed must be an array of objects when using JSON input.
 * - Upsert mode identifies existing rows by a `fileName` property on each document.
 * - createMany skipDuplicates only takes effect when unique constraints exist in the schema; failures will fall back to per-item insertion.
 *
 * @async
 * @function main
 * @returns {Promise<void>} Resolves when seeding completes or when the function exits; in some error cases the process may exit with a non-zero code.
 *
 * @example
 * // Run interactively (will prompt)
 * ts-node prisma/seed.ts
 *
 * // Force run without prompt
 * ts-node prisma/seed.ts --force
 *
 * // Dry-run to see what would be done
 * ts-node prisma/seed.ts --dry-run
 *
 * // Upsert mode for JSON input (match by fileName)
 * ts-node prisma/seed.ts --upsert
 */
async function main(): Promise<void> {
    // Resolve seed files relative to project root when running compiled code (dist/)
    // In development (ts-node), process.cwd() is project root; in production, the same.
    const projectRoot = process.env.PROJECT_ROOT || process.cwd()
    const jsonPath = path.resolve(projectRoot, 'data', 'seed-documents.json')
    const sqlPath = path.resolve(projectRoot, 'seed-documents.sql')

    let seedData: any = null

    if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, { encoding: 'utf8' })
        try {
            seedData = JSON.parse(raw)
        } catch (err) {
            LogError('Failed to parse JSON seed file:', err)
            process.exit(1)
        }
    } else if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, { encoding: 'utf8' })
        if (!sql || sql.trim().length === 0) {
            LogError('Seed SQL file is empty')
            process.exit(1)
        }
        seedData = { sql }
    } else {
        LogError('No seed file found (data/seed-documents.json or seed-documents.sql)')
        process.exit(1)
    }

    const argv = process.argv.slice(2)
    const force = argv.includes('--force') || argv.includes('--yes') || argv.includes('-y')
    const dryRun = argv.includes('--dry-run') || argv.includes('--dryrun')
    const upsertMode = argv.includes('--upsert') || argv.includes('--upsert-by-filename')

    async function doSeed(): Promise<void> {
        if (seedData.sql) {
            LogInfo('Source: SQL file -> ' + sqlPath)
            LogInfo('Records: (raw SQL)')
            if (dryRun) {
                LogInfo('[dry-run] Would execute SQL seed (no DB changes).')
                await prisma.$disconnect()
                return
            }

            LogInfo('Running seed SQL...')
            try {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                // @ts-ignore - using raw SQL from seed file (intentional)
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                await prisma.$executeRawUnsafe(seedData.sql)
                LogInfo('Seeding complete (SQL).')
            } catch (err) {
                LogError('Failed to execute seed SQL:', err)
                process.exitCode = 1
            } finally {
                await prisma.$disconnect()
            }
            return
        }

        if (!Array.isArray(seedData)) {
            LogError('JSON seed must be an array of records')
            process.exit(1)
        }

        LogInfo(`Source: JSON -> ${jsonPath}`)
        LogInfo(`Total records: ${seedData.length}`)

        if (dryRun) {
            LogInfo('[dry-run] No changes will be made. Sample record:')
            LogInfo(JSON.stringify(seedData[0], null, 2))
            await prisma.$disconnect()
            return
        }

        if (upsertMode) {
            LogInfo('Upsert mode: will update existing records matched by fileName, else create.')
            try {
                let created = 0
                let updated = 0
                for (const doc of seedData) {
                    const fileName = doc.fileName || null
                    if (!fileName) {
                        try {
                            await prisma.document.create({ data: doc })
                            created++
                        } catch (err) {
                            LogWarning('Create failed for record (no fileName): ' + String(err))
                        }
                        continue
                    }

                    const existing = await prisma.document.findFirst({ where: { fileName } })
                    if (existing) {
                        try {
                            await prisma.document.update({ where: { id: existing.id }, data: doc })
                            updated++
                        } catch (err) {
                            LogWarning('Update failed for ' + fileName + ' - ' + String(err))
                        }
                    } else {
                        try {
                            await prisma.document.create({ data: doc })
                            created++
                        } catch (err) {
                            LogWarning('Create failed for ' + fileName + ' - ' + String(err))
                        }
                    }
                }
                LogInfo(`Upsert complete. Created: ${created}, Updated: ${updated}`)
            } catch (err) {
                LogError('Failed during upsert processing:', err)
                process.exitCode = 1
            } finally {
                await prisma.$disconnect()
            }
            return
        }

        LogInfo('Attempting bulk insert with createMany (skipDuplicates: true).')
        try {
            await prisma.document.createMany({ data: seedData, skipDuplicates: true })
            LogInfo('Bulk insert complete (createMany).')
            await prisma.$disconnect()
            return
        } catch (bulkErr) {
            LogWarning('createMany failed or not fully supported for this data. Falling back to per-item insert. ' + String(bulkErr))
        }

        try {
            let created = 0
            for (const doc of seedData) {
                try {
                    await prisma.document.create({ data: doc })
                    created++
                } catch (err) {
                    LogWarning('Insert error for ' + (doc.fileName || '(no filename)') + ' - ' + String(err))
                }
            }
            LogInfo(`Seeding complete (created ${created}/${seedData.length}).`)
        } catch (err) {
            LogError('Failed to insert seed JSON via Prisma:', err)
            process.exitCode = 1
        } finally {
            await prisma.$disconnect()
        }
    }

    if (dryRun) {
        LogInfo('[dry-run] Summary:')
        if (seedData.sql) {
            LogInfo('  Source: SQL file')
        } else {
            LogInfo(`  Source: JSON file (${seedData.length} records)`)
        }
        LogInfo('  Flags: ' + JSON.stringify({ force, dryRun, upsertMode }))
        await doSeed()
        return
    }

    if (force) {
        await doSeed()
        return
    }

    if (process.stdin.isTTY) {
        const rl = await import('readline')
        const reader = rl.createInterface({ input: process.stdin, output: process.stdout })
        const answer = await new Promise<string>((resolve) =>
            reader.question('This will modify your database. Type "yes" to continue: ', (ans) => {
                reader.close()
                resolve(ans)
            }),
        )
        if (String(answer).trim().toLowerCase() === 'yes') {
            await doSeed()
        } else {
            LogInfo('Seed aborted.')
            await prisma.$disconnect()
            process.exit(0)
        }
    } else {
        LogError('Non-interactive shell detected. To run the seed, pass --force or run in an interactive terminal.')
        await prisma.$disconnect()
        process.exit(1)
    }
}

void main()
