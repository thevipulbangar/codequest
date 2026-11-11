-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('pending', 'active', 'rejected', 'suspended');

-- CreateTable
CREATE TABLE "Satellite" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "noradId" INTEGER NOT NULL,
    "intlDesignator" TEXT,
    "band" TEXT NOT NULL,
    "downlinkMHz" DOUBLE PRECISION NOT NULL,
    "protocol" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Satellite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroundStation" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "altitudeM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "antennaType" TEXT NOT NULL,
    "antennaSizeM" DOUBLE PRECISION NOT NULL,
    "bands" TEXT[],
    "protocols" TEXT[],
    "pricePerPass" DECIMAL(12,2) NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'pending',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroundStation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Satellite_noradId_key" ON "Satellite"("noradId");

-- CreateIndex
CREATE INDEX "Satellite_ownerId_idx" ON "Satellite"("ownerId");

-- CreateIndex
CREATE INDEX "Satellite_status_idx" ON "Satellite"("status");

-- CreateIndex
CREATE INDEX "GroundStation_ownerId_idx" ON "GroundStation"("ownerId");

-- CreateIndex
CREATE INDEX "GroundStation_status_idx" ON "GroundStation"("status");

-- AddForeignKey
ALTER TABLE "Satellite" ADD CONSTRAINT "Satellite_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroundStation" ADD CONSTRAINT "GroundStation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
