import { HttpError } from "../../shared/middleware/http_error.js";
import type { AuthenticatedUser } from "../../shared/middleware/authentication.js";
import { readReportPdf } from "../../shared/storage/report_storage.js";
import * as orderRepository from "../../shared/repository/order.repository.js";
import * as templateRepository from "../../shared/repository/report-template.repository.js";
import * as reportRepository from "../../shared/repository/report.repository.js";

interface DraftInput {
  content: Record<string, string>;
  amendmentReason?: string | undefined;
}

function assertAssignedOrAdmin(
  user: AuthenticatedUser,
  assignedRadiologistId: string | null,
): void {
  if (
    user.role !== "facility_admin" &&
    assignedRadiologistId !== user.userId
  ) {
    throw new HttpError(403, "Report is assigned to another radiologist");
  }
}

function validateContent(
  sections: Array<{ key: string; label: string; required: boolean }>,
  content: Record<string, string>,
): void {
  const allowedKeys = new Set(sections.map((section) => section.key));
  if (Object.keys(content).some((key) => !allowedKeys.has(key))) {
    throw new HttpError(400, "Report contains fields not defined by its template");
  }
  for (const section of sections) {
    if (section.required && !content[section.key]?.trim()) {
      throw new HttpError(400, `${section.label} is required`);
    }
  }
}

export async function createDraft(
  user: AuthenticatedUser,
  orderId: string,
  templateId: string,
) {
  const result = await orderRepository.getOrder(user.facilityId, orderId);
  if (!result) {
    throw new HttpError(404, "Order not found");
  }
  const { order } = result;
  assertAssignedOrAdmin(user, order.assignedRadiologistId);
  if (order.status !== "in_progress") {
    throw new HttpError(409, "Order must be in progress before drafting a report");
  }

  const template = await templateRepository.getTemplate(
    user.facilityId,
    templateId,
  );
  if (!template) {
    throw new HttpError(404, "Report template not found");
  }
  const initialContent = Object.fromEntries(
    template.sections.map((section) => [section.key, ""]),
  );
  return reportRepository.createDraft(
    user.facilityId,
    orderId,
    templateId,
    user.userId,
    initialContent,
  );
}

export async function getDraft(
  user: AuthenticatedUser,
  orderId: string,
) {
  const result = await reportRepository.getReportForOrder(
    user.facilityId,
    orderId,
  );
  if (!result) {
    throw new HttpError(404, "Report not found");
  }
  assertAssignedOrAdmin(user, result.order.assignedRadiologistId);
  const versions = await reportRepository.listVersions(
    user.facilityId,
    result.report.id,
  );
  return { ...result.report, versions };
}

export async function getReportOverview(
  user: AuthenticatedUser,
  orderId: string,
) {
  const order = await orderRepository.getOrder(user.facilityId, orderId);
  if (!order) {
    throw new HttpError(404, "Order not found");
  }
  if (
    user.role === "radiologist" &&
    order.order.assignedRadiologistId !== user.userId
  ) {
    throw new HttpError(404, "Report not found");
  }
  const overview = await reportRepository.getReportOverview(
    user.facilityId,
    orderId,
  );
  if (!overview) {
    throw new HttpError(404, "Report not found");
  }
  return overview;
}

export async function saveDraft(
  user: AuthenticatedUser,
  reportId: string,
  input: DraftInput,
) {
  const current = await reportRepository.getReport(user.facilityId, reportId);
  if (!current) {
    throw new HttpError(404, "Report not found");
  }
  assertAssignedOrAdmin(user, current.order.assignedRadiologistId);

  const template = await templateRepository.getTemplate(
    user.facilityId,
    current.report.templateId,
  );
  if (!template) {
    throw new HttpError(409, "The report template is no longer available");
  }
  validateContent(template.sections, input.content);

  if (
    current.report.latestVersionNumber > 0 &&
    !(input.amendmentReason ?? current.report.draftAmendmentReason)?.trim()
  ) {
    throw new HttpError(400, "An amendment reason is required");
  }
  const report = await reportRepository.saveDraft(
    user.facilityId,
    reportId,
    user.userId,
    input.content,
    input.amendmentReason,
  );
  if (!report) {
    throw new HttpError(404, "Report not found");
  }
  return report;
}

export async function signDraft(
  user: AuthenticatedUser,
  reportId: string,
  operation: "sign" | "amend",
) {
  const current = await reportRepository.getReport(user.facilityId, reportId);
  if (!current) {
    throw new HttpError(404, "Report not found");
  }
  assertAssignedOrAdmin(user, current.order.assignedRadiologistId);
  if (
    (operation === "sign" && current.report.latestVersionNumber > 0) ||
    (operation === "amend" && current.report.latestVersionNumber === 0)
  ) {
    throw new HttpError(409, "Report is not in the expected signing state");
  }

  const template = await templateRepository.getTemplate(
    user.facilityId,
    current.report.templateId,
  );
  if (!template) {
    throw new HttpError(409, "The report template is no longer available");
  }
  validateContent(template.sections, current.report.draftContent);
  return reportRepository.signDraft(
    user.facilityId,
    reportId,
    user.userId,
    user.role === "facility_admin",
  );
}

export async function listVersions(
  user: AuthenticatedUser,
  reportId: string,
) {
  const report = await reportRepository.getReport(user.facilityId, reportId);
  if (!report) {
    throw new HttpError(404, "Report not found");
  }
  assertAssignedOrAdmin(user, report.order.assignedRadiologistId);
  return reportRepository.listVersions(user.facilityId, reportId);
}

export async function getStaffPdf(user: AuthenticatedUser, versionId: string) {
  const access = await reportRepository.getVersionAccess(
    user.facilityId,
    versionId,
  );
  if (!access) {
    throw new HttpError(404, "Report PDF is not ready");
  }
  if (
    user.role === "radiologist" &&
    access.order.assignedRadiologistId !== user.userId
  ) {
    throw new HttpError(404, "Report PDF is not ready");
  }
  const version = await reportRepository.getReadyPdfVersion(
    user.facilityId,
    versionId,
  );
  if (!version?.pdfRelativePath) {
    throw new HttpError(404, "Report PDF is not ready");
  }
  return readReportPdf(version.pdfRelativePath);
}
