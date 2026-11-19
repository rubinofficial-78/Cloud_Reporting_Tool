import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  auditEvents,
  reportTemplates,
  type ReportTemplateSection,
} from "../db/schema.js";

export async function listTemplates(facilityId: string) {
  return db
    .select()
    .from(reportTemplates)
    .where(
      and(
        eq(reportTemplates.facilityId, facilityId),
        eq(reportTemplates.active, true),
      ),
    )
    .orderBy(asc(reportTemplates.name), asc(reportTemplates.version));
}

export async function getTemplate(facilityId: string, templateId: string) {
  const [template] = await db
    .select()
    .from(reportTemplates)
    .where(
      and(
        eq(reportTemplates.facilityId, facilityId),
        eq(reportTemplates.id, templateId),
        eq(reportTemplates.active, true),
      ),
    )
    .limit(1);
  return template;
}

export async function createTemplate(
  facilityId: string,
  createdBy: string,
  name: string,
  sections: ReportTemplateSection[],
) {
  return db.transaction(async (tx) => {
    const [template] = await tx
      .insert(reportTemplates)
      .values({ facilityId, createdBy, name, sections })
      .returning();
    if (!template) {
      throw new Error("Template insert did not return a row");
    }
    await tx.insert(auditEvents).values({
      facilityId,
      actorUserId: createdBy,
      action: "report_template.created",
      resourceType: "report_template",
      resourceId: template.id,
      metadata: { name: template.name, version: template.version },
    });
    return template;
  });
}
