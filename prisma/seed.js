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

  console.log('Running seed SQL from', sqlPath)
  try {
    // Use $executeRawUnsafe to run raw SQL from the seed file.
    // This file contains INSERT statements for the Document table.
    await prisma.$executeRawUnsafe(sql)
    console.log('Seeding complete.')
  } catch (err) {
    console.error('Failed to execute seed SQL:', err)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
