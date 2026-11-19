import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  auditEvents,
  patientShareLinks,
  reportVersions,
} from "../db/schema.js";

export async function createShareLink(
  facilityId: string,
  reportVersionId: string,
  tokenHash: string,
  createdBy: string,
  expiresAt: Date,
) {
  return db.transaction(async (tx) => {
    const [version] = await tx
      .select()
      .from(reportVersions)
      .where(
        and(
          eq(reportVersions.facilityId, facilityId),
          eq(reportVersions.id, reportVersionId),
        ),
      )
      .for("update")
      .limit(1);
    if (!version || version.pdfStatus !== "ready") {
      return undefined;
    }

    const [link] = await tx
      .insert(patientShareLinks)
      .values({
        facilityId,
        reportVersionId,
        tokenHash,
        createdBy,
        expiresAt,
      })
      .returning();
    if (!link) {
      throw new Error("Share link insert did not return a row");
    }
    await tx.insert(auditEvents).values({
      facilityId,
      actorUserId: createdBy,
      action: "patient_share.created",
      resourceType: "patient_share_link",
      resourceId: link.id,
      metadata: { reportVersionId },
    });
    return link;
  });
}

export async function revokeShareLink(
  facilityId: string,
  shareLinkId: string,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [link] = await tx
      .update(patientShareLinks)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(patientShareLinks.facilityId, facilityId),
          eq(patientShareLinks.id, shareLinkId),
          isNull(patientShareLinks.revokedAt),
        ),
      )
      .returning();
    if (!link) {
      return undefined;
    }
    await tx.insert(auditEvents).values({
      facilityId,
      actorUserId: actorId,
      action: "patient_share.revoked",
      resourceType: "patient_share_link",
      resourceId: link.id,
      metadata: { reportVersionId: link.reportVersionId },
    });
    return link;
  });
}

export async function getActiveLinkByHash(tokenHash: string) {
  const [link] = await db
    .select()
    .from(patientShareLinks)
    .where(
      and(
        eq(patientShareLinks.tokenHash, tokenHash),
        isNull(patientShareLinks.revokedAt),
        gt(patientShareLinks.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return link;
}

export async function getActiveLinkForVersion(
  facilityId: string,
  shareLinkId: string,
  versionId: string,
) {
  const [link] = await db
    .select()
    .from(patientShareLinks)
    .where(
      and(
        eq(patientShareLinks.facilityId, facilityId),
        eq(patientShareLinks.id, shareLinkId),
        eq(patientShareLinks.reportVersionId, versionId),
        isNull(patientShareLinks.revokedAt),
        gt(patientShareLinks.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return link;
}

export async function recordPatientAccess(
  facilityId: string,
  shareLinkId: string,
  versionId: string,
) : Promise<boolean> {
  return db.transaction(async (tx) => {
    const [link] = await tx
      .select()
      .from(patientShareLinks)
      .where(
        and(
          eq(patientShareLinks.facilityId, facilityId),
          eq(patientShareLinks.id, shareLinkId),
          eq(patientShareLinks.reportVersionId, versionId),
          isNull(patientShareLinks.revokedAt),
          gt(patientShareLinks.expiresAt, new Date()),
        ),
      )
      .for("update")
      .limit(1);
    if (!link) {
      return false;
    }

    await tx
      .update(patientShareLinks)
      .set({ lastAccessAt: new Date() })
      .where(eq(patientShareLinks.id, link.id));
    await tx.insert(auditEvents).values({
      facilityId,
      actorUserId: null,
      action: "patient_report.accessed",
      resourceType: "report_version",
      resourceId: versionId,
      metadata: { shareLinkId },
    });
    return true;
  });
}
