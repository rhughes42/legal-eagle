import { PrismaClient } from '@prisma/client'
import { LogInfo, LogError } from '../src/common/logger'

async function main(): Promise<void> {
    const prisma = new PrismaClient()
    try {
        const count = await prisma.document.count()
        LogInfo('document_count ' + String(count))
        if (count && count > 0) {
            LogInfo('Seed check passed')
            process.exit(0)
        } else {
            LogError('Seed check failed: no documents found')
            process.exit(2)
        }
    } catch (err) {
        LogError('Seed check error: ' + String(err))
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

void main()
