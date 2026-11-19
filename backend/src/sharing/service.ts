import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import {
  durationSeconds,
  shareLinkDurationHours,
} from "../../shared/duration.js";
import { HttpError } from "../../shared/middleware/http_error.js";
import type { AuthenticatedUser } from "../../shared/middleware/authentication.js";
import * as reportRepository from "../../shared/repository/report.repository.js";
import * as shareLinkRepository from "../../shared/repository/share-link.repository.js";
import { readReportPdf } from "../../shared/storage/report_storage.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters");
  }
  return secret;
}

export async function createShareLink(
  user: AuthenticatedUser,
  versionId: string,
  expiresInHours: number,
) {
  shareLinkDurationHours(expiresInHours);
  const versionAccess = await reportRepository.getVersionAccess(
    user.facilityId,
    versionId,
  );
  if (
    !versionAccess ||
    (user.role === "radiologist" &&
      versionAccess.order.assignedRadiologistId !== user.userId)
  ) {
    throw new HttpError(404, "Report version not found");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const link = await shareLinkRepository.createShareLink(
    user.facilityId,
    versionId,
    hashToken(rawToken),
    user.userId,
    expiresAt,
  );
  if (!link) {
    throw new HttpError(409, "A signed report with a ready PDF is required");
  }

  const origin = (
    process.env.FRONTEND_ORIGIN ?? "http://localhost:5173"
  ).replace(/\/+$/, "");
  return {
    id: link.id,
    url: `${origin}/#/patient-report?token=${rawToken}`,
    expiresAt: link.expiresAt,
  };
}

export async function revokeShareLink(
  user: AuthenticatedUser,
  shareLinkId: string,
) {
  const link = await shareLinkRepository.revokeShareLink(
    user.facilityId,
    shareLinkId,
    user.userId,
  );
  if (!link) {
    throw new HttpError(404, "Share link not found");
  }
}

export async function exchangeToken(rawToken: string) {
  const link = await shareLinkRepository.getActiveLinkByHash(hashToken(rawToken));
  if (!link) {
    throw new HttpError(404, "Share link is invalid or expired");
  }
  const tokenTtl = process.env.PATIENT_ACCESS_TTL ?? "5m";
  const accessToken = jwt.sign(
    {
      facilityId: link.facilityId,
      shareLinkId: link.id,
      versionId: link.reportVersionId,
    },
    jwtSecret(),
    {
      algorithm: "HS256",
      audience: "patient-report",
      expiresIn: durationSeconds(tokenTtl, "PATIENT_ACCESS_TTL", 15 * 60),
    },
  );
  return {
    accessToken,
    tokenType: "Bearer",
    expiresIn: tokenTtl,
    versionId: link.reportVersionId,
  };
}

export async function getPatientPdf(
  facilityId: string,
  shareLinkId: string,
  versionId: string,
) {
  const link = await shareLinkRepository.getActiveLinkForVersion(
    facilityId,
    shareLinkId,
    versionId,
  );
  if (!link) {
    throw new HttpError(404, "Report is not available");
  }
  const version = await reportRepository.getReadyPdfVersion(
    facilityId,
    versionId,
  );
  if (!version?.pdfRelativePath) {
    throw new HttpError(404, "Report is not available");
  }
  const accessRecorded = await shareLinkRepository.recordPatientAccess(
    facilityId,
    shareLinkId,
    versionId,
  );
  if (!accessRecorded) {
    throw new HttpError(404, "Report is not available");
  }
  return readReportPdf(version.pdfRelativePath);
}
