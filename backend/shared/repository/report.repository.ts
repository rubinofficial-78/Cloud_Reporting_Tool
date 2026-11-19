import {
  and,
  desc,
  eq,
} from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  auditEvents,
  facilities,
  orders,
  outboxJobs,
  patients,
  reportTemplates,
  reportVersions,
  reports,
  users,
} from "../db/schema.js";
import { HttpError } from "../middleware/http_error.js";

export async function getReportForOrder(facilityId: string, orderId: string) {
  const [result] = await db
    .select({ report: reports, order: orders })
    .from(reports)
    .innerJoin(
      orders,
      and(
        eq(orders.facilityId, reports.facilityId),
        eq(orders.id, reports.orderId),
      ),
    )
    .where(and(eq(reports.facilityId, facilityId), eq(reports.orderId, orderId)))
    .limit(1);
  return result;
}

export async function getReportOverview(facilityId: string, orderId: string) {
  const [result] = await db
    .select({
      report: {
        id: reports.id,
        status: reports.status,
        latestVersionNumber: reports.latestVersionNumber,
      },
      order: {
        assignedRadiologistId: orders.assignedRadiologistId,
      },
      latestVersion: {
        id: reportVersions.id,
        versionNumber: reportVersions.versionNumber,
        pdfStatus: reportVersions.pdfStatus,
        signedAt: reportVersions.signedAt,
      },
    })
    .from(reports)
    .innerJoin(
      orders,
      and(
        eq(orders.facilityId, reports.facilityId),
        eq(orders.id, reports.orderId),
      ),
    )
    .leftJoin(
      reportVersions,
      and(
        eq(reportVersions.facilityId, reports.facilityId),
        eq(reportVersions.reportId, reports.id),
        eq(reportVersions.versionNumber, reports.latestVersionNumber),
      ),
    )
    .where(and(eq(reports.facilityId, facilityId), eq(reports.orderId, orderId)))
    .limit(1);
  return result;
}

export async function getReport(facilityId: string, reportId: string) {
  const [result] = await db
    .select({ report: reports, order: orders })
    .from(reports)
    .innerJoin(
      orders,
      and(
        eq(orders.facilityId, reports.facilityId),
        eq(orders.id, reports.orderId),
      ),
    )
    .where(and(eq(reports.facilityId, facilityId), eq(reports.id, reportId)))
    .limit(1);
  return result;
}

export async function createDraft(
  facilityId: string,
  orderId: string,
  templateId: string,
  actorId: string,
  initialContent: Record<string, string>,
) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.facilityId, facilityId), eq(orders.id, orderId)))
      .for("update")
      .limit(1);
    if (!order) {
      throw new HttpError(404, "Order not found");
    }

    const [existing] = await tx
      .select()
      .from(reports)
      .where(and(eq(reports.facilityId, facilityId), eq(reports.orderId, orderId)))
      .limit(1);
    if (existing) {
      return existing;
    }

    const [report] = await tx
      .insert(reports)
      .values({
        facilityId,
        orderId,
        templateId,
        draftContent: initialContent,
      })
      .returning();
    if (!report) {
      throw new Error("Report insert did not return a row");
    }
    await tx.insert(auditEvents).values({
      facilityId,
      actorUserId: actorId,
      action: "report.draft_created",
      resourceType: "report",
      resourceId: report.id,
      metadata: { orderId },
    });
    return report;
  });
}

export async function saveDraft(
  facilityId: string,
  reportId: string,
  actorId: string,
  content: Record<string, string>,
  amendmentReason?: string,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(reports)
      .where(and(eq(reports.facilityId, facilityId), eq(reports.id, reportId)))
      .for("update")
      .limit(1);
    if (!current) {
      return undefined;
    }
    if (current.status === "signed" && current.latestVersionNumber > 0) {
      if (!amendmentReason?.trim()) {
        throw new HttpError(400, "An amendment reason is required");
      }
    }
    if (current.status === "signed" && current.latestVersionNumber === 0) {
      throw new HttpError(409, "Signed report cannot be edited; create an amendment");
    }

    const reason =
      amendmentReason?.trim() || current.draftAmendmentReason || null;
    const [updated] = await tx
      .update(reports)
      .set({
        draftContent: content,
        draftAmendmentReason: reason,
        status: "draft",
        updatedAt: new Date(),
      })
      .where(eq(reports.id, reportId))
      .returning();
    await tx.insert(auditEvents).values({
      facilityId,
      actorUserId: actorId,
      action: "report.draft_saved",
      resourceType: "report",
      resourceId: reportId,
      metadata: {},
    });
    return updated;
  });
}

export async function signDraft(
  facilityId: string,
  reportId: string,
  signerId: string,
  canSignAnyAssignment: boolean,
) {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .select()
      .from(reports)
      .where(and(eq(reports.facilityId, facilityId), eq(reports.id, reportId)))
      .for("update")
      .limit(1);
    if (!report) {
      throw new HttpError(404, "Report not found");
    }
    if (report.status !== "draft") {
      throw new HttpError(409, "Report has no unsigned draft");
    }

    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.facilityId, facilityId), eq(orders.id, report.orderId)))
      .for("update")
      .limit(1);
    if (!order) {
      throw new HttpError(404, "Order not found");
    }
    if (!canSignAnyAssignment && order.assignedRadiologistId !== signerId) {
      throw new HttpError(403, "Report is assigned to another radiologist");
    }
    if (
      report.latestVersionNumber === 0 &&
      order.status !== "in_progress"
    ) {
      throw new HttpError(409, "Order must be in progress before signing");
    }
    if (
      report.latestVersionNumber > 0 &&
      !report.draftAmendmentReason?.trim()
    ) {
      throw new HttpError(400, "An amendment reason is required");
    }

    const versionNumber = report.latestVersionNumber + 1;
    const [version] = await tx
      .insert(reportVersions)
      .values({
        facilityId,
        reportId,
        templateId: report.templateId,
        versionNumber,
        content: report.draftContent,
        amendmentReason: report.draftAmendmentReason,
        signedBy: signerId,
      })
      .returning();
    if (!version) {
      throw new Error("Signed report version insert did not return a row");
    }

    await tx
      .update(reports)
      .set({
        status: "signed",
        latestVersionNumber: versionNumber,
        draftAmendmentReason: null,
        updatedAt: new Date(),
      })
      .where(eq(reports.id, reportId));
    await tx
      .update(orders)
      .set({ status: "reported", updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    await tx.insert(outboxJobs).values({
      facilityId,
      jobType: "generate_report_pdf",
      payload: { reportVersionId: version.id },
    });
    await tx.insert(auditEvents).values({
      facilityId,
      actorUserId: signerId,
      action: versionNumber === 1 ? "report.signed" : "report.amended",
      resourceType: "report_version",
      resourceId: version.id,
      metadata: { reportId, versionNumber },
    });
    return version;
  });
}

export async function listVersions(facilityId: string, reportId: string) {
  return db
    .select()
    .from(reportVersions)
    .where(
      and(
        eq(reportVersions.facilityId, facilityId),
        eq(reportVersions.reportId, reportId),
      ),
    )
    .orderBy(desc(reportVersions.versionNumber));
}

export async function getPdfSource(facilityId: string, versionId: string) {
  const [source] = await db
    .select({
      version: reportVersions,
      template: reportTemplates,
      order: orders,
      patient: patients,
      facility: facilities,
      signer: { email: users.email },
    })
    .from(reportVersions)
    .innerJoin(
      reports,
      and(
        eq(reports.facilityId, reportVersions.facilityId),
        eq(reports.id, reportVersions.reportId),
      ),
    )
    .innerJoin(
      orders,
      and(
        eq(orders.facilityId, reports.facilityId),
        eq(orders.id, reports.orderId),
      ),
    )
    .innerJoin(
      patients,
      and(
        eq(patients.facilityId, orders.facilityId),
        eq(patients.id, orders.patientId),
      ),
    )
    .innerJoin(
      facilities,
      eq(facilities.id, reportVersions.facilityId),
    )
    .innerJoin(
      reportTemplates,
      and(
        eq(reportTemplates.facilityId, reportVersions.facilityId),
        eq(reportTemplates.id, reportVersions.templateId),
      ),
    )
    .innerJoin(users, eq(users.id, reportVersions.signedBy))
    .where(
      and(
        eq(reportVersions.facilityId, facilityId),
        eq(reportVersions.id, versionId),
      ),
    )
    .limit(1);
  return source;
}

export async function getVersion(facilityId: string, versionId: string) {
  const [version] = await db
    .select()
    .from(reportVersions)
    .where(
      and(
        eq(reportVersions.facilityId, facilityId),
        eq(reportVersions.id, versionId),
      ),
    )
    .limit(1);
  return version;
}

export async function getVersionAccess(
  facilityId: string,
  versionId: string,
) {
  const [result] = await db
    .select({
      version: reportVersions,
      order: { assignedRadiologistId: orders.assignedRadiologistId },
    })
    .from(reportVersions)
    .innerJoin(
      reports,
      and(
        eq(reports.facilityId, reportVersions.facilityId),
        eq(reports.id, reportVersions.reportId),
      ),
    )
    .innerJoin(
      orders,
      and(
        eq(orders.facilityId, reports.facilityId),
        eq(orders.id, reports.orderId),
      ),
    )
    .where(
      and(
        eq(reportVersions.facilityId, facilityId),
        eq(reportVersions.id, versionId),
      ),
    )
    .limit(1);
  return result;
}

export async function markPdfReady(
  facilityId: string,
  versionId: string,
  relativePath: string,
  sha256: string,
) {
  await db
    .update(reportVersions)
    .set({
      pdfStatus: "ready",
      pdfRelativePath: relativePath,
      pdfSha256: sha256,
    })
    .where(
      and(
        eq(reportVersions.facilityId, facilityId),
        eq(reportVersions.id, versionId),
      ),
    );
}

export async function markPdfFailed(facilityId: string, versionId: string) {
  await db
    .update(reportVersions)
    .set({ pdfStatus: "failed" })
    .where(
      and(
        eq(reportVersions.facilityId, facilityId),
        eq(reportVersions.id, versionId),
      ),
    );
}

export async function markPdfProcessing(facilityId: string, versionId: string) {
  await db
    .update(reportVersions)
    .set({ pdfStatus: "processing" })
    .where(
      and(
        eq(reportVersions.facilityId, facilityId),
        eq(reportVersions.id, versionId),
      ),
    );
}

export async function getReadyPdfVersion(facilityId: string, versionId: string) {
  const [version] = await db
    .select()
    .from(reportVersions)
    .where(
      and(
        eq(reportVersions.facilityId, facilityId),
        eq(reportVersions.id, versionId),
        eq(reportVersions.pdfStatus, "ready"),
      ),
    )
    .limit(1);
  return version;
}

