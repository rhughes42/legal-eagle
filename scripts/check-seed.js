const { PrismaClient } = require('@prisma/client')

async function main() {
  const prisma = new PrismaClient()
  try {
    const count = await prisma.document.count()
    console.log('document_count', count)
    if (count && count > 0) {
      console.log('Seed check passed')
      process.exit(0)
    } else {
      console.error('Seed check failed: no documents found')
      process.exit(2)
    }
  } catch (err) {
    console.error('Seed check error:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
