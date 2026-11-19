-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "preferredChores" TEXT[] DEFAULT ARRAY[]::TEXT[];
