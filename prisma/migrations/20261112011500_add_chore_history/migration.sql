-- CreateEnum
CREATE TYPE "ChoreHistoryEventType" AS ENUM ('created', 'completed', 'reopened', 'due_date_changed');

-- CreateTable
CREATE TABLE "ChoreHistory" (
    "id" UUID NOT NULL,
    "choreId" UUID NOT NULL,
    "eventType" "ChoreHistoryEventType" NOT NULL,
    "dueDate" DATE,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoreHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChoreHistory_choreId_createdAt_idx" ON "ChoreHistory"("choreId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChoreHistory" ADD CONSTRAINT "ChoreHistory_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreHistory" ADD CONSTRAINT "ChoreHistory_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
