/*
  Warnings:

  - The primary key for the `Document` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `content` on the `Document` table. All the data in the column will be lost.
  - You are about to drop the column `sourceUrl` on the `Document` table. All the data in the column will be lost.
  - The `id` column on the `Document` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `fileName` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" DROP CONSTRAINT "Document_pkey",
DROP COLUMN "content",
DROP COLUMN "sourceUrl",
ADD COLUMN     "area" TEXT,
ADD COLUMN     "areaData" JSONB,
ADD COLUMN     "caseNumber" TEXT,
ADD COLUMN     "caseType" TEXT,
ADD COLUMN     "court" TEXT,
ADD COLUMN     "date" TIMESTAMP(3),
ADD COLUMN     "fileName" TEXT NOT NULL,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "summary" TEXT,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ALTER COLUMN "title" DROP NOT NULL,
ADD CONSTRAINT "Document_pkey" PRIMARY KEY ("id");
