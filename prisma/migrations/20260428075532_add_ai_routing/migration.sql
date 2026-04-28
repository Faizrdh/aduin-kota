-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "ai_label" TEXT,
ADD COLUMN     "ai_overridden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ai_override_at" TIMESTAMP(3),
ADD COLUMN     "ai_override_by" TEXT,
ADD COLUMN     "confidence_score" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "reports_ai_label_idx" ON "reports"("ai_label");
