-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" UUID NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "organization" TEXT,
    "province" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SightingReport" (
    "id" UUID NOT NULL,
    "publicReference" TEXT NOT NULL,
    "reporterId" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT,
    "subdistrict" TEXT,
    "locationDescription" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "quantityRange" TEXT NOT NULL,
    "note" TEXT,
    "imagePath" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "riskLevel" "RiskLevel",
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SightingReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_clerkUserId_key" ON "UserProfile"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "SightingReport_publicReference_key" ON "SightingReport"("publicReference");

-- CreateIndex
CREATE INDEX "SightingReport_reporterId_idx" ON "SightingReport"("reporterId");

-- CreateIndex
CREATE INDEX "SightingReport_status_idx" ON "SightingReport"("status");

-- CreateIndex
CREATE INDEX "SightingReport_province_idx" ON "SightingReport"("province");

-- CreateIndex
CREATE INDEX "SightingReport_observedAt_idx" ON "SightingReport"("observedAt");

-- CreateIndex
CREATE INDEX "SightingReport_createdAt_idx" ON "SightingReport"("createdAt");

-- AddForeignKey
ALTER TABLE "SightingReport" ADD CONSTRAINT "SightingReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
