// A test household full of chores and history, so a preview (or the dev database) has
// something to show on the chore list and the three chore histories. Run by
// server/seed/run.ts (AGENTS.md "Commands"). Sign in as Test_User@test.com.
import { getAuth } from "../auth.js";
import { getPrisma } from "../db.js";
import { findPasswordAccountByEmail, setPassword } from "../models/accounts.js";
import { newInviteCode } from "../services/inviteCode.js";

export const TEST_HOUSE_NAME = "Test_House_Data";
// Not a secret: these accounts only exist on previews and the dev database.
export const TEST_PASSWORD = "password2";

export const TEST_PEOPLE = {
  you: { name: "Test_User", email: "Test_User@test.com", role: "owner" },
  first: { name: "Test_Housemate_1", email: "Test_Housemate_1@test.com", role: "member" },
  second: { name: "Test_Housemate_2", email: "Test_Housemate_2@test.com", role: "member" },
} as const;

export type TestPerson = keyof typeof TEST_PEOPLE;
const PEOPLE = Object.keys(TEST_PEOPLE) as TestPerson[];

/**
 * Where this run may write: a Vercel preview's own database, or the dev database when
 * run by hand with --local. Never production, and nothing on Vercel unless it says preview.
 */
export function seedTarget(env: Record<string, string | undefined>, args: readonly string[]): "preview" | "local" | null {
  if (env.VERCEL) return env.VERCEL_ENV === "preview" ? "preview" : null;
  return args.includes("--local") ? "local" : null;
}

/** Today in Michigan, "YYYY-MM-DD", so a build server's "today" matches the team's phones. */
export function teamToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit" }).format(now);
}

const DAY_MS = 86_400_000;
const shift = (today: string, days: number) =>
  new Date(Date.parse(`${today}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Days from today, and an hour in UTC. 14–23 UTC is daytime in Michigan, so the date holds. */
type When = readonly [days: number, hourUtc: number];
const moment = (today: string, [days, hour]: When) =>
  new Date(`${shift(today, days)}T${String(hour).padStart(2, "0")}:00:00Z`);

type EventType = "created" | "completed" | "reopened" | "due_date_changed";
type PlannedEvent = { type: EventType; by: TestPerson; at: When; due?: number };
type PlannedChore = {
  name: string;
  notes?: string;
  assignee: TestPerson;
  createdBy: TestPerson;
  created: When;
  /** Days from today. */
  due: number;
  done?: When;
  /** The whole history, when it's more than "created" (and "completed" if done). */
  events?: PlannedEvent[];
};

// Every status (to do, overdue, done, late) across this week, last week and before.
const CHORES: PlannedChore[] = [
  // Test_User's chores: My chore history.
  { name: "Water the plants", assignee: "you", createdBy: "first", created: [-2, 15], due: 2 },
  { name: "Take out the trash", notes: "Recycling goes out too.", assignee: "you", createdBy: "you", created: [-4, 15], due: 0 },
  { name: "Clean the bathroom", notes: "Sink, mirror and floor.", assignee: "you", createdBy: "second", created: [-9, 15], due: -2 },
  { name: "Vacuum the living room", assignee: "you", createdBy: "you", created: [-10, 15], due: -3, done: [-3, 20] },
  {
    name: "Wipe down the kitchen counters",
    notes: "Spray, then dry with the blue cloth.",
    assignee: "you",
    createdBy: "first",
    created: [-11, 14],
    due: -6,
    done: [-4, 16],
    // Rescheduled, done, undone, then done for good: every kind of event on one chore.
    events: [
      { type: "created", by: "first", at: [-11, 14], due: -7 },
      { type: "due_date_changed", by: "first", at: [-9, 18], due: -6 },
      { type: "completed", by: "you", at: [-5, 22] },
      { type: "reopened", by: "you", at: [-5, 23] },
      { type: "completed", by: "you", at: [-4, 16] },
    ],
  },
  { name: "Do the dishes", assignee: "you", createdBy: "you", created: [-11, 15], due: -7, done: [-7, 21] },
  { name: "Mop the kitchen floor", notes: "Use the blue bucket.", assignee: "you", createdBy: "second", created: [-16, 15], due: -10, done: [-8, 17] },
  { name: "Restock toilet paper", assignee: "you", createdBy: "you", created: [-18, 15], due: -13, done: [-14, 19] },
  // The housemates' chores, for Household chore history.
  { name: "Fold the laundry", assignee: "first", createdBy: "first", created: [-5, 15], due: -1, done: [-1, 18] },
  { name: "Clean out the fridge", notes: "Toss anything expired.", assignee: "second", createdBy: "you", created: [-3, 15], due: 1 },
  { name: "Sweep the porch", assignee: "second", createdBy: "second", created: [-7, 15], due: -3, done: [-2, 16] },
  { name: "Buy dish soap", assignee: "first", createdBy: "first", created: [-1, 15], due: 4 },
  { name: "Change the air filter", assignee: "first", createdBy: "you", created: [-15, 15], due: -9, done: [-9, 20] },
];

export type SeedChore = {
  name: string;
  notes: string | null;
  assignee: TestPerson;
  createdBy: TestPerson;
  dueDate: string;
  createdAt: Date;
  completedAt: Date | null;
  events: { eventType: EventType; dueDate: string; actor: TestPerson; createdAt: Date }[];
};

/** The household's chores, dated from `today` ("YYYY-MM-DD"). */
export function testHouseChores(today: string): SeedChore[] {
  return CHORES.map((chore) => {
    const events: PlannedEvent[] = chore.events ?? [
      { type: "created", by: chore.createdBy, at: chore.created },
      ...(chore.done ? [{ type: "completed" as const, by: chore.assignee, at: chore.done }] : []),
    ];
    return {
      name: chore.name,
      notes: chore.notes ?? null,
      assignee: chore.assignee,
      createdBy: chore.createdBy,
      dueDate: shift(today, chore.due),
      createdAt: moment(today, chore.created),
      completedAt: chore.done ? moment(today, chore.done) : null,
      events: events.map((event) => ({
        eventType: event.type,
        dueDate: shift(today, event.due ?? chore.due),
        actor: event.by,
        createdAt: moment(today, event.at),
      })),
    };
  });
}

/** The test person's user id. Signs them up the way the app does if they're new. */
async function ensureAccount(person: TestPerson): Promise<string> {
  const { name, email } = TEST_PEOPLE[person];
  const existing = await findPasswordAccountByEmail(email.toLowerCase());
  if (existing) {
    // Someone may have changed it while testing; put it back so the documented login works.
    await setPassword(existing.userId, TEST_PASSWORD);
    return existing.userId;
  }
  const { user } = await getAuth().api.signUpEmail({ body: { name, email, password: TEST_PASSWORD } });
  return user.id;
}

/**
 * Puts the test household back to its starting state: the three accounts, Test_User as
 * owner, and today's version of the chores and their history. Safe to run again and again.
 */
export async function seedTestHouse(today = teamToday()): Promise<{ inviteCode: string; chores: number }> {
  const ids = {} as Record<TestPerson, string>;
  for (const person of PEOPLE) ids[person] = await ensureAccount(person);
  const chores = testHouseChores(today);

  return getPrisma().$transaction(
    async (tx) => {
      const current = await tx.membership.findUnique({ where: { userId: ids.you } });
      let household;
      if (current) {
        // Never touch a household that real people have joined.
        const others = await tx.membership.count({
          where: { householdId: current.householdId, userId: { notIn: Object.values(ids) } },
        });
        if (others > 0) throw new Error(`${TEST_PEOPLE.you.email} shares a household with other accounts; left it alone.`);
        household = await tx.household.update({ where: { id: current.householdId }, data: { name: TEST_HOUSE_NAME } });
      } else {
        household = await tx.household.create({ data: { name: TEST_HOUSE_NAME, inviteCode: newInviteCode() } });
      }

      for (const person of PEOPLE) {
        const { role } = TEST_PEOPLE[person];
        await tx.membership.upsert({
          where: { userId: ids[person] },
          update: { householdId: household.id, role },
          create: { userId: ids[person], householdId: household.id, role },
        });
      }

      // Their history goes with them (onDelete: Cascade).
      await tx.chore.deleteMany({ where: { householdId: household.id } });
      for (const chore of chores) {
        await tx.chore.create({
          data: {
            householdId: household.id,
            name: chore.name,
            notes: chore.notes,
            assigneeId: ids[chore.assignee],
            createdById: ids[chore.createdBy],
            dueDate: new Date(`${chore.dueDate}T00:00:00Z`),
            createdAt: chore.createdAt,
            completedAt: chore.completedAt,
            completedById: chore.completedAt ? ids[chore.assignee] : null,
            history: {
              create: chore.events.map((event) => ({
                eventType: event.eventType,
                dueDate: new Date(`${event.dueDate}T00:00:00Z`),
                actorId: ids[event.actor],
                createdAt: event.createdAt,
              })),
            },
          },
        });
      }

      return { inviteCode: household.inviteCode, chores: chores.length };
    },
    { timeout: 30_000 },
  );
}
