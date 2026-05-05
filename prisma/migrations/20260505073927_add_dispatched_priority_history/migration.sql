-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('NORMAL', 'HIGH', 'EMERGENCY');

-- AlterEnum
ALTER TYPE "ReportStatus" ADD VALUE 'DISPATCHED';

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "priority" "Priority" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "status_histories" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "fromStatus" "ReportStatus",
    "toStatus" "ReportStatus" NOT NULL,
    "note" TEXT,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "status_histories_reportId_idx" ON "status_histories"("reportId");

-- CreateIndex
CREATE INDEX "status_histories_adminId_idx" ON "status_histories"("adminId");

-- CreateIndex
CREATE INDEX "status_histories_createdAt_idx" ON "status_histories"("createdAt");

-- CreateIndex
CREATE INDEX "reports_priority_idx" ON "reports"("priority");

-- AddForeignKey
ALTER TABLE "status_histories" ADD CONSTRAINT "status_histories_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_histories" ADD CONSTRAINT "status_histories_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
