import * as outboxRepository from "../../shared/repository/outbox.repository.js";
import * as reportRepository from "../../shared/repository/report.repository.js";
import * as pdfService from "../reports/pdf_service.js";

const pollIntervalMs = 250;
const maxAttempts = Number(process.env.MAX_PDF_JOB_ATTEMPTS ?? 5);

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startPdfWorker(): Promise<void> {
  console.log("PDF worker started");
  while (true) {
    try {
      const job = await outboxRepository.claimNextJob();
      if (!job) {
        await pause(pollIntervalMs);
        continue;
      }

      try {
        await pdfService.processPdfJob(job);
      } catch (error) {
        const versionId = job.payload.reportVersionId;
        const safeMessage =
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Unknown job failure";
        const terminal = await outboxRepository.failJob(
          job.id,
          job.attempts,
          maxAttempts,
          safeMessage,
        );
        if (terminal && versionId) {
          await reportRepository.markPdfFailed(job.facilityId, versionId);
        }
        console.error("PDF job failed", {
          jobId: job.id,
          attempt: job.attempts,
          terminal,
          error: safeMessage,
        });
      }
    } catch (error) {
      console.error(
        "PDF worker polling failed",
        error instanceof Error ? error.name : "Unknown worker failure",
      );
      await pause(pollIntervalMs * 4);
    }
  }
}
