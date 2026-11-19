import { HttpError } from "../../shared/middleware/http_error.js";
import { writeReportPdf } from "../../shared/storage/report_storage.js";
import * as reportRepository from "../../shared/repository/report.repository.js";
import * as outboxRepository from "../../shared/repository/outbox.repository.js";
import { createReportPdf } from "./pdf_document.js";

export async function generateVersionPdf(
  facilityId: string,
  versionId: string,
): Promise<void> {
  const source = await reportRepository.getPdfSource(facilityId, versionId);
  if (!source) {
    throw new HttpError(404, "Report version was not found");
  }
  const bytes = await createReportPdf(source);
  const { relativePath, sha256 } = await writeReportPdf(
    facilityId,
    versionId,
    bytes,
  );
  await reportRepository.markPdfReady(
    facilityId,
    versionId,
    relativePath,
    sha256,
  );
}

export async function processPdfJob(job: {
  id: string;
  facilityId: string;
  jobType: string;
  payload: Record<string, string>;
}): Promise<void> {
  if (job.jobType !== "generate_report_pdf") {
    throw new Error("Unsupported outbox job type");
  }
  const versionId = job.payload.reportVersionId;
  if (!versionId) {
    throw new Error("PDF job is missing its report version ID");
  }
  await reportRepository.markPdfProcessing(job.facilityId, versionId);
  await generateVersionPdf(job.facilityId, versionId);
  await outboxRepository.completeJob(job.id);
}
