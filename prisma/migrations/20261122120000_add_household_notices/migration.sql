-- CreateEnum
CREATE TYPE "HouseholdNoticeKind" AS ENUM ('member_left');

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "noticesSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "HouseholdNotice" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "kind" "HouseholdNoticeKind" NOT NULL,
    "personName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HouseholdNotice_householdId_createdAt_idx" ON "HouseholdNotice"("householdId", "createdAt");

-- AddForeignKey
ALTER TABLE "HouseholdNotice" ADD CONSTRAINT "HouseholdNotice_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

