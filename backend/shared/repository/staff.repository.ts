import { and, asc, count, eq } from "drizzle-orm";
import { HttpError } from "../middleware/http_error.js";
import { db } from "../db/connection.js";
import {
  auditEvents,
  facilities,
  facilityMemberships,
  users,
} from "../db/schema.js";

export async function listRadiologists(facilityId: string) {
  return db
    .select({
      id: users.id,
      email: users.email,
      role: facilityMemberships.role,
      active: facilityMemberships.active,
    })
    .from(facilityMemberships)
    .innerJoin(users, eq(users.id, facilityMemberships.userId))
    .where(
      and(
        eq(facilityMemberships.facilityId, facilityId),
        eq(facilityMemberships.role, "radiologist"),
      ),
    )
    .orderBy(asc(users.email));
}

export async function setMembershipActive(
  facilityId: string,
  userId: string,
  active: boolean,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [facility] = await tx
      .select({ id: facilities.id })
      .from(facilities)
      .where(eq(facilities.id, facilityId))
      .for("update")
      .limit(1);
    if (!facility) {
      return undefined;
    }

    const [membership] = await tx
      .select()
      .from(facilityMemberships)
      .where(
        and(
          eq(facilityMemberships.facilityId, facilityId),
          eq(facilityMemberships.userId, userId),
        ),
      )
      .for("update")
      .limit(1);
    if (!membership) {
      return undefined;
    }

    if (!active && membership.role === "facility_admin") {
      const [admins] = await tx
        .select({ activeAdmins: count() })
        .from(facilityMemberships)
        .where(
          and(
            eq(facilityMemberships.facilityId, facilityId),
            eq(facilityMemberships.role, "facility_admin"),
            eq(facilityMemberships.active, true),
          ),
        );
      if (admins && admins.activeAdmins <= 1) {
        throw new HttpError(409, "A facility must keep at least one active administrator");
      }
    }

    const [updated] = await tx
      .update(facilityMemberships)
      .set({ active })
      .where(eq(facilityMemberships.id, membership.id))
      .returning();
    if (updated) {
      await tx.insert(auditEvents).values({
        facilityId,
        actorUserId: actorId,
        action: active ? "staff.membership_activated" : "staff.membership_deactivated",
        resourceType: "facility_membership",
        resourceId: membership.id,
        metadata: { userId },
      });
    }
    return updated;
  });
}
