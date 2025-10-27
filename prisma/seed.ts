/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import 'dotenv/config'
import { LogInfo, LogDebug, LogError, LogWarning } from '../src/common/logger'

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

/**
 * Seeds the application's database from either a JSON array or a raw SQL file, with safeguards
 * for dry runs, interactive confirmation, and an optional upsert strategy.
 *
 * High-level flow:
 * - Resolve project root and detect a seed source:
 *   - data/seed-documents.json (preferred)
 *   - data/seed-documents.sql (fallback)
 * - Parse CLI flags: --force/-y, --dry-run/--dryrun, --upsert/--upsert-by-filename
 * - Dry-run: preview actions and exit without DB changes.
 * - Confirm (TTY prompt) unless --force is provided.
 * - Execute seeding:
 *   - SQL mode: run the raw SQL as-is.
 *   - JSON mode: prefer bulk insert; fall back to per-item insert; optional upsert-by-filename.
 * - Always attempt to disconnect Prisma; set exit codes on failure paths.
 *
 * @remarks
 * Sources
 * - JSON: data/seed-documents.json must contain an array of records compatible with prisma.document.create().
 *   If present, it takes precedence over SQL.
 * - SQL: data/seed-documents.sql is executed verbatim when JSON is absent.
 *   Uses prisma.$executeRawUnsafe, so the file is expected to be trusted.
 *
 * Path resolution
 * - Uses process.env.PROJECT_ROOT if set; otherwise falls back to process.cwd().
 *   Both JSON and SQL paths are resolved under {root}/data/.
 *
 * Flags
 * - --dry-run | --dryrun
 *   Prints a summary of the intended operation. In JSON mode, prints a sample record. No DB writes occur.
 * - --force | --yes | -y
 *   Skips the interactive confirmation prompt and proceeds immediately.
 * - --upsert | --upsert-by-filename
 *   JSON-only. Attempts to update an existing row matched by fileName; otherwise creates a new row.
 *   - If fileName is missing on a record, it will be created (no upsert lookup).
 *   - Updates use the found record's id to ensure a precise target.
 *
 * Execution details
 * - SQL mode:
 *   - Dry-run: logs intent only.
 *   - Execute: prisma.$executeRawUnsafe(seedSQL).
 *   - Ensures prisma.$disconnect() in a finally block.
 *
 * - JSON mode:
 *   - Validates that the parsed JSON is an array; exits with error otherwise.
 *   - Upsert strategy (when enabled):
 *     1) Find existing by fileName (findFirst).  // assumes fileName is effectively unique
 *     2) Update by id if found; otherwise create.
 *     3) Tracks and logs created/updated counts; warns on per-record failures.
 *   - Bulk insert strategy (default when not upserting):
 *     1) Attempt prisma.document.createMany({ skipDuplicates: true }).
 *     2) If createMany fails or is partially unsupported, fallback to per-item prisma.document.create().
 *     3) Logs warnings for records that fail individually and reports a created count.
 *   - Always disconnects Prisma when work in this branch completes.
 *
 * Safety and confirmation
 * - If --dry-run is provided: prints a summary and exits early after disconnecting.
 * - If --force is provided: proceeds without prompting.
 * - Otherwise, if running in a TTY: prompts the user to type "yes" before proceeding.
 * - If not in a TTY and not forced: exits with an error instructing to pass --force.
 *
 * Error handling and exits
 * - Missing/empty seed file or invalid JSON: logs an error and exits with a non-zero code.
 * - Database or file operation errors: logs the error, sets process.exitCode, and ensures Prisma disconnects.
 * - Notes:
 *   - Some fatal validation errors (e.g., no seed file found) call process.exit(1) immediately.
 *   - Non-fatal path errors prefer setting process.exitCode over throwing.
 *
 * Environment
 * - PROJECT_ROOT: optional; overrides the root used to resolve data/seed-documents.* paths.
 *
 * Logging
 * - Uses LogInfo/LogWarning/LogError (external helpers) to communicate progress, warnings, and failures.
 *
 * Dependencies and expectations
 * - Expects an initialized PrismaClient instance named prisma in scope.
 * - Expects a Prisma model "document" compatible with the shape of the JSON records.
 * - Assumes fileName serves as a practical unique identifier for upsert mode.
 *
 * @returns A promise that resolves when seeding completes, or after the process is terminated/exit code is set.
 *
 * @example
 * // Preview (no DB changes), auto-detect seed source:
 * // - Shows sample JSON record when JSON source is present
 * // - Shows summary only for SQL
 * node dist/prisma/seed.js --dry-run
 *
 * @example
 * // Force seeding without prompt (JSON bulk insert with skipDuplicates):
 * node dist/prisma/seed.js --force
 *
 * @example
 * // Upsert JSON records matched by fileName:
 * node dist/prisma/seed.js --upsert --force
 *
 * @example
 * // Run directly from TypeScript in development:
 * ts-node app/prisma/seed.ts --dry-run
 */
async function main(): Promise<void> {
	LogDebug('⏩ Starting database seed process...')

	// Resolve seed files relative to project root when running compiled code (dist/)
	// In development (ts-node), process.cwd() is project root; in production, the same.
	const projectRoot = process.env.PROJECT_ROOT || process.cwd()
	const jsonPath = path.resolve(projectRoot, 'data', 'seed-documents.json')
	const sqlPath = path.resolve(projectRoot, 'data', 'seed-documents.sql')

	let seedData: any = null

	// Load seed data from JSON or SQL file
	if (fs.existsSync(jsonPath)) {
		LogDebug('💾 Loading seed data from JSON file: ' + jsonPath)
		const raw = fs.readFileSync(jsonPath, { encoding: 'utf8' })

		// Attempt to parse JSON
		try {
			seedData = JSON.parse(raw)
			LogDebug('✅ Loaded JSON seed data successfully.')
		} catch (err) {
			LogError('❌ Failed to parse JSON seed file:', err)
			process.exit(1)
		}
	} else if (fs.existsSync(sqlPath)) {
		const sql = fs.readFileSync(sqlPath, { encoding: 'utf8' })
		if (!sql || sql.trim().length === 0) {
			LogError('❌ Seed SQL file is empty')
			process.exit(1)
		}
		seedData = { sql }
	} else {
		LogError('❌ No seed file found (data/seed-documents.json or seed-documents.sql)')
		process.exit(1)
	}

	LogDebug('✅ Seed data source loaded.')
	LogDebug('🔍 Parsing command-line arguments...')

	// Parse command-line arguments for flags.
	const argv = process.argv.slice(2)
	const force = argv.includes('--force') || argv.includes('--yes') || argv.includes('-y')
	const dryRun = argv.includes('--dry-run') || argv.includes('--dryrun')
	const upsertMode = argv.includes('--upsert') || argv.includes('--upsert-by-filename')

	LogDebug(`⚙️  Flags - force: ${force}, dryRun: ${dryRun}, upsertMode: ${upsertMode}`)

	// Function to perform the actual seeding
	async function doSeed(): Promise<void> {
		LogDebug('🌱 Starting seed process...')

		// Handle SQL seed data
		if (seedData.sql) {
			LogInfo('💾 Source: SQL file -> ' + sqlPath)
			LogInfo('📄 Records: (raw SQL)')

			// If dry-run mode is active, show the intended action and exit
			if (dryRun) {
				LogInfo('[dry-run] Would execute SQL seed (no DB changes).')
				await prisma.$disconnect()
				return
			}

			// Attempt to run the actual SQL
			LogInfo('🌱 Running seed SQL...')
			try {
				// Developer Note: Running raw SQL from a file is inherently unsafe if the file source is untrusted.
				// This is intended for trusted development or controlled production environments only.
				await prisma.$executeRawUnsafe(seedData.sql)
				LogInfo('🌳 Seeding complete (SQL).')
			} catch (err) {
				LogError('❌ Failed to execute seed SQL:', err)
				process.exitCode = 1
			} finally {
				await prisma.$disconnect()
			}
			return
		}

		// Handle JSON seed data
		if (!Array.isArray(seedData)) {
			LogError('❌ JSON seed must be an array of records')
			process.exit(1)
		}

		LogInfo(`💾 Source: JSON -> ${jsonPath}`)
		LogInfo(`📄 Total records: ${seedData.length}`)

		// If dry-run mode is active, show the intended action and exit
		if (dryRun) {
			LogInfo('[dry-run] No changes will be made. Sample record:')
			LogInfo(JSON.stringify(seedData[0], null, 2))
			await prisma.$disconnect()
			return
		}

		// Upsert mode: update existing records matched by fileName, else create
		if (upsertMode) {
			LogInfo('🔃 Upsert mode: will update existing records matched by fileName, else create.')

			// Attempt upsert processing
			try {
				let created = 0
				let updated = 0

				// Process each of the records
				for (const doc of seedData) {
					const fileName = doc.fileName || null
					if (!fileName) {
						// Absent fileName, just create.
						// Todo: Use the GenerateRandom function that was added to the resolver.
						// Not reimplementing the GUID routing for the sake of DRY here...

						// Generate a random file name (simpler version is doc.fileName = 'random-doc-' + (created + updated * (234 * 193))
						// Or, find the equivalent of .NET System.Environment.ProcessorId + created + updated etc.
						doc.fileName = 'random-doc-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now().toString() + '.pdf'

						// Attempt the creation process with the data we have.
						try {
							await prisma.document.create({ data: doc })
							LogInfo('⚠️ Created record without correct name.')
							created++
						} catch (err) {
							LogWarning('⚠️ Create failed for record (no fileName): ' + String(err))
						}
						continue
					}

					/**
					 * Find existing record by fileName.
					 * If found, update it; otherwise, create a new record.
					 *
					 * @args doc The document data to upsert (where :: filename)
					 */
					const existing = await prisma.document.findFirst({ where: { fileName } })
					// If found, update it; otherwise, create a new record.
					if (existing) {
						try {
							await prisma.document.update({ where: { id: existing.id }, data: doc })
							updated++
						} catch (err) {
							LogWarning('⚠️ Update failed for ' + fileName + ' - ' + String(err))
						}
					} else {
						try {
							await prisma.document.create({ data: doc })
							created++
						} catch (err) {
							LogWarning('⚠️ Create failed for ' + fileName + ' - ' + String(err))
						}
					}
				}
				LogInfo(`✅ Upsert complete. Created: ${created}, Updated: ${updated}`)
			} catch (err) {
				LogError('❌ Failed during upsert processing:', err)
				process.exitCode = 1
			} finally {
				await prisma.$disconnect()
			}
			return
		}

		LogInfo('⏩ Attempting bulk insert with createMany (skipDuplicates: true).')
		try {
			await prisma.document.createMany({ data: seedData, skipDuplicates: true })
			LogInfo('✅ Bulk insert complete (createMany).')
			await prisma.$disconnect()
			return
		} catch (bulkErr) {
			LogWarning('⚠️ createMany failed or not fully supported for this data. Falling back to per-item insert. ' + String(bulkErr))
		}

		try {
			let created = 0
			for (const doc of seedData) {
				try {
					await prisma.document.create({ data: doc })
					created++
				} catch (err) {
					LogWarning('⚠️ Insert error for ' + (doc.fileName || '(no filename)') + ' - ' + String(err))
				}
			}
			LogInfo(`✅ Seeding complete (created ${created}/${seedData.length}).`)
		} catch (err) {
			LogError('❌ Failed to insert seed JSON via Prisma:', err)
			process.exitCode = 1
		} finally {
			await prisma.$disconnect()
		}
	}

	// If dry-run is used, preview changes but don't commit them.
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

	// If the force flag is used, skip any checks.
	if (force) {
		await doSeed()
		return
	}

	// Check if the session is interactive or not.
	if (process.stdin.isTTY) {
		const rl = await import('readline')
		const reader = rl.createInterface({ input: process.stdin, output: process.stdout })
		const answer = await new Promise<string>((resolve) =>
			reader.question('⚠️ This will modify your database. Are you sure you want to continue? ( [Yes] / No ): ', (ans) => {
				reader.close()
				resolve(ans)
			}),
		)
		if (String(answer).trim().toLowerCase() === 'yes' || String(answer).trim().toLowerCase() === 'y') {
			await doSeed()
		} else if (String(answer).trim() === '') {
			await doSeed()
		} else {
			LogInfo('❌ Seed aborted.')
			await prisma.$disconnect()
			process.exit(0)
		}
	} else {
		LogError('⚠️ Non-interactive shell detected. To run the seed, pass --force or run in an interactive terminal.')
		await prisma.$disconnect()
		process.exit(1)
	}
}

void main()
