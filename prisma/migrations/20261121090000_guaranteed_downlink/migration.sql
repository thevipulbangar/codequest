-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('active', 'fulfilled', 'missed', 'cancelled');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerType" ADD VALUE 'premium';
ALTER TYPE "LedgerType" ADD VALUE 'compensation';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "backup" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "plannedMB" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "DataContract" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "satelliteId" TEXT NOT NULL,
    "targetMB" DOUBLE PRECISION NOT NULL,
    "rateKbps" DOUBLE PRECISION NOT NULL,
    "minElDeg" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "deadline" TIMESTAMP(3) NOT NULL,
    "passCost" DECIMAL(12,2) NOT NULL,
    "premium" DECIMAL(12,2) NOT NULL,
    "compensation" DECIMAL(12,2) NOT NULL,
    "confidenceBps" INTEGER NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'active',
    "verifiedMB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataContract_operatorId_idx" ON "DataContract"("operatorId");

-- CreateIndex
CREATE INDEX "DataContract_status_deadline_idx" ON "DataContract"("status", "deadline");

-- CreateIndex
CREATE INDEX "Booking_contractId_idx" ON "Booking"("contractId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "DataContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataContract" ADD CONSTRAINT "DataContract_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataContract" ADD CONSTRAINT "DataContract_satelliteId_fkey" FOREIGN KEY ("satelliteId") REFERENCES "Satellite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

