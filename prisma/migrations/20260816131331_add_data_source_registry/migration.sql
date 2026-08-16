-- CreateTable
CREATE TABLE "DataSource" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "authorityType" TEXT NOT NULL,
    "trustTier" TEXT NOT NULL DEFAULT 'trusted',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "homepage" TEXT,
    "coverageMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DataSource_slug_key" ON "DataSource"("slug");

-- CreateIndex
CREATE INDEX "DataSource_enabled_idx" ON "DataSource"("enabled");

-- CreateIndex
CREATE INDEX "DataSource_category_idx" ON "DataSource"("category");

-- CreateIndex
CREATE INDEX "DataSource_transport_idx" ON "DataSource"("transport");
