-- CreateEnum
CREATE TYPE "AssignmentMethod" AS ENUM ('rotate', 'preferences', 'manager');

-- CreateEnum
CREATE TYPE "WeeklyWorkload" AS ENUM ('light', 'medium', 'heavy');

-- AlterTable
ALTER TABLE "Household" ADD COLUMN     "assignmentMethod" "AssignmentMethod";

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "choreTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "weeklyWorkload" "WeeklyWorkload";
