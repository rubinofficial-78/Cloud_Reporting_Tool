import { and, eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  auditEvents,
  facilities,
  facilityMemberships,
  users,
} from "../db/schema.js";

export async function findStaffMembership(email: string, facilityId: string) {
  const [membership] = await db
    .select({
      userId: users.id,
      email: users.email,
      passwordHash: users.passwordHash,
      active: users.active,
      facilityId: facilityMemberships.facilityId,
      facilityName: facilities.name,
      role: facilityMemberships.role,
    })
    .from(users)
    .innerJoin(facilityMemberships, eq(facilityMemberships.userId, users.id))
    .innerJoin(facilities, eq(facilities.id, facilityMemberships.facilityId))
    .where(
      and(
        eq(users.email, email),
        eq(facilityMemberships.facilityId, facilityId),
        eq(facilityMemberships.active, true),
      ),
    )
    .limit(1);
  return membership;
}

export async function hasActiveMembership(
  userId: string,
  facilityId: string,
  role: "front_desk" | "radiologist" | "facility_admin",
): Promise<boolean> {
  const [membership] = await db
    .select({ id: facilityMemberships.id })
    .from(facilityMemberships)
    .innerJoin(users, eq(users.id, facilityMemberships.userId))
    .where(
      and(
        eq(facilityMemberships.userId, userId),
        eq(facilityMemberships.facilityId, facilityId),
        eq(facilityMemberships.role, role),
        eq(facilityMemberships.active, true),
        eq(users.active, true),
      ),
    )
    .limit(1);
  return Boolean(membership);
}

export async function recordLogin(userId: string, facilityId: string) {
  await db.insert(auditEvents).values({
    facilityId,
    actorUserId: userId,
    action: "staff.login",
    resourceType: "user",
    resourceId: userId,
    metadata: {},
  });
}
