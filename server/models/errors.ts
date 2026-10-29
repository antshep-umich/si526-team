// Database errors, in terms the services can use without knowing about Prisma.

/** A write broke one of the database's unique rules (for example, a taken invite code). */
export class UniqueConflictError extends Error {
  constructor() {
    super("Unique constraint failed");
    this.name = "UniqueConflictError";
  }
}

/** True for Prisma's "unique constraint failed" error (code P2002). */
function isPrismaUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2002";
}

/** Runs a write, turning Prisma's unique-violation error into UniqueConflictError. */
export async function translateUniqueConflict<T>(write: () => Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (err) {
    if (isPrismaUniqueViolation(err)) throw new UniqueConflictError();
    throw err;
  }
}
