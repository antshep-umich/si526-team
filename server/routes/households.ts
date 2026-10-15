import express, { type Response } from "express";
import {
  normalizeInviteCode,
  parseHouseholdName,
  HOUSEHOLD_NAME_MAX_LENGTH,
  type HouseholdResponse,
} from "../../shared/api.js";
import { getPrisma } from "../db.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import { sendError } from "../http.js";
import { newInviteCode } from "../inviteCode.js";
import { currentUser } from "../session.js";

// Household routes (TECH_SPEC section 6). Mounted at /api/households behind
// requireUser, so every handler has a signed-in user.
//
// Authorization: no route takes a household id. "current" always means the
// household the signed-in user belongs to, so there is no id to guess.
export const householdsRouter = express.Router();

const CODE_ATTEMPTS = 5;

/** True for Prisma's "unique constraint failed" error. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

function findMembership(prisma: PrismaClient, userId: string) {
  return prisma.membership.findUnique({ where: { userId } });
}

async function sendHousehold(
  res: Response,
  status: number,
  prisma: PrismaClient,
  householdId: string,
  userId: string,
): Promise<void> {
  const household = await prisma.household.findUniqueOrThrow({
    where: { id: householdId },
    include: { memberships: { orderBy: { joinedAt: "asc" } } },
  });
  const mine = household.memberships.find((m) => m.userId === userId);
  if (!mine) throw new Error("User is not a member of the household being returned");
  const body: HouseholdResponse = {
    id: household.id,
    name: household.name,
    inviteCode: household.inviteCode,
    createdAt: household.createdAt.toISOString(),
    role: mine.role,
    members: household.memberships.map((m) => ({
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
  res.status(status).json(body);
}

function sendAlreadyInHousehold(res: Response): void {
  sendError(res, 409, "ALREADY_IN_HOUSEHOLD", "You already belong to a household");
}

function sendNoHousehold(res: Response): void {
  sendError(res, 404, "NO_HOUSEHOLD", "You don't belong to a household yet");
}

// Create a household. The creator becomes its owner.
householdsRouter.post("/", async (req, res) => {
  const userId = currentUser(res).id;
  const name = parseHouseholdName(req.body?.name);
  if (!name) {
    sendError(
      res,
      400,
      "VALIDATION_ERROR",
      `Household name must be 1 to ${HOUSEHOLD_NAME_MAX_LENGTH} characters`,
    );
    return;
  }

  const prisma = getPrisma();
  if (await findMembership(prisma, userId)) {
    sendAlreadyInHousehold(res);
    return;
  }

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    try {
      // One nested write, so a household can never exist without its owner.
      const household = await prisma.household.create({
        data: {
          name,
          inviteCode: newInviteCode(),
          memberships: { create: { userId, role: "owner" } },
        },
      });
      await sendHousehold(res, 201, prisma, household.id, userId);
      return;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // Either this user joined or created a household a moment ago (two tabs),
      // or the random invite code is already taken. Only the second is worth a retry.
      if (await findMembership(prisma, userId)) {
        sendAlreadyInHousehold(res);
        return;
      }
    }
  }
  throw new Error("Could not generate an unused invite code");
});

// Join a household with its invite code.
householdsRouter.post("/join", async (req, res) => {
  const userId = currentUser(res).id;
  const inviteCode = normalizeInviteCode(req.body?.inviteCode);
  if (!inviteCode) {
    sendError(res, 400, "VALIDATION_ERROR", "Enter an invite code");
    return;
  }

  const prisma = getPrisma();
  const household = await prisma.household.findUnique({ where: { inviteCode } });
  if (!household) {
    sendError(res, 404, "INVITE_CODE_NOT_FOUND", "No household has that invite code");
    return;
  }

  let membership = await findMembership(prisma, userId);
  if (!membership) {
    try {
      membership = await prisma.membership.create({
        data: { userId, householdId: household.id, role: "member" },
      });
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      // The same user joined somewhere a moment ago (double click, two tabs).
      membership = await findMembership(prisma, userId);
      if (!membership) throw err;
    }
  }
  if (membership.householdId !== household.id) {
    sendAlreadyInHousehold(res);
    return;
  }
  // Joining the household you're already in succeeds, so a double click is harmless.
  await sendHousehold(res, 200, prisma, household.id, userId);
});

// The signed-in user's household and its members.
householdsRouter.get("/current", async (_req, res) => {
  const userId = currentUser(res).id;
  const prisma = getPrisma();
  const membership = await findMembership(prisma, userId);
  if (!membership) {
    sendNoHousehold(res);
    return;
  }
  await sendHousehold(res, 200, prisma, membership.householdId, userId);
});

// Replace the invite code (owner only). The old code stops working immediately.
householdsRouter.post("/current/invite-code", async (_req, res) => {
  const userId = currentUser(res).id;
  const prisma = getPrisma();
  const membership = await findMembership(prisma, userId);
  if (!membership) {
    sendNoHousehold(res);
    return;
  }
  if (membership.role !== "owner") {
    sendError(res, 403, "FORBIDDEN", "Only the household owner can change the invite code");
    return;
  }

  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
    try {
      await prisma.household.update({
        where: { id: membership.householdId },
        data: { inviteCode: newInviteCode() },
      });
      await sendHousehold(res, 200, prisma, membership.householdId, userId);
      return;
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new Error("Could not generate an unused invite code");
});
