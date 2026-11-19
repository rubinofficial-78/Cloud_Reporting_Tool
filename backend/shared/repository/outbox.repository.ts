import { and, asc, eq, lt, lte, or } from "drizzle-orm";
import { db } from "../db/connection.js";
import { outboxJobs } from "../db/schema.js";

export async function claimNextJob() {
  const now = new Date();
  const staleLock = new Date(now.getTime() - 5 * 60 * 1000);
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(outboxJobs)
      .where(
        or(
          and(
            eq(outboxJobs.status, "pending"),
            lte(outboxJobs.availableAt, now),
          ),
          and(
            eq(outboxJobs.status, "processing"),
            lt(outboxJobs.lockedAt, staleLock),
          ),
        ),
      )
      .orderBy(asc(outboxJobs.availableAt))
      .for("update", { skipLocked: true })
      .limit(1);
    if (!job) {
      return undefined;
    }

    const [claimed] = await tx
      .update(outboxJobs)
      .set({
        status: "processing",
        attempts: job.attempts + 1,
        lockedAt: now,
      })
      .where(eq(outboxJobs.id, job.id))
      .returning();
    return claimed;
  });
}

export async function completeJob(jobId: string) {
  await db
    .update(outboxJobs)
    .set({
      status: "completed",
      completedAt: new Date(),
      lockedAt: null,
      lastError: null,
    })
    .where(eq(outboxJobs.id, jobId));
}

export async function failJob(
  jobId: string,
  attempts: number,
  maxAttempts: number,
  safeMessage: string,
) {
  const retry = attempts < maxAttempts;
  const delayMs = Math.min(30_000 * 2 ** Math.max(attempts - 1, 0), 15 * 60_000);
  await db
    .update(outboxJobs)
    .set({
      status: retry ? "pending" : "failed",
      availableAt: new Date(Date.now() + delayMs),
      lockedAt: null,
      lastError: safeMessage.slice(0, 1000),
    })
    .where(eq(outboxJobs.id, jobId));
  return !retry;
}
