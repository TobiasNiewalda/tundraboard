-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "estimated_hours" INTEGER;

-- AddConstraint
ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_estimated_hours_check"
CHECK ("estimated_hours" IS NULL OR "estimated_hours" > 0);

-- CreateIndex
CREATE INDEX "tasks_estimated_hours_idx" ON "tasks"("estimated_hours");