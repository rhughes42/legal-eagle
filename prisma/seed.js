const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const prisma = new PrismaClient()

async function main() {
  const sqlPath = path.resolve(__dirname, '..', 'seed-documents.sql')
  if (!fs.existsSync(sqlPath)) {
    console.error(`Seed file not found at ${sqlPath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(sqlPath, { encoding: 'utf8' })
  if (!sql || sql.trim().length === 0) {
    console.error('Seed file is empty')
    process.exit(1)
  }

  // Confirmation: require explicit --force or --yes to avoid accidental runs
  const force = process.argv.includes('--force') || process.argv.includes('--yes') || process.argv.includes('-y')

  async function doSeed() {
    console.log('Running seed SQL from', sqlPath)
    try {
      await prisma.$executeRawUnsafe(sql)
      console.log('Seeding complete.')
    } catch (err) {
      console.error('Failed to execute seed SQL:', err)
      process.exitCode = 1
    } finally {
      await prisma.$disconnect()
    }
  }

  if (force) {
    await doSeed()
    return
  }

  // Interactive confirmation when possible
  if (process.stdin.isTTY) {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout })
    const answer = await new Promise((resolve) => rl.question('This will execute SQL against your database. Type "yes" to continue: ', (ans) => { rl.close(); resolve(ans) }))
    if (String(answer).trim().toLowerCase() === 'yes') {
      await doSeed()
    } else {
      console.log('Seed aborted.')
      await prisma.$disconnect()
      process.exit(0)
    }
  } else {
    console.error('Non-interactive shell detected. To run the seed, pass --force or run in an interactive terminal.')
    await prisma.$disconnect()
    process.exit(1)
  }
}

main()
