import type { Request, Response } from "express";
import { z } from "zod";
import {
  getAuthenticatedUser,
} from "../../shared/middleware/authentication.js";
import { getPatientAccess } from "../../shared/middleware/patient_access.js";
import { HttpError } from "../../shared/middleware/http_error.js";
import { successResponse } from "../../shared/response_format.js";
import * as sharingService from "./service.js";

const versionParamsSchema = z.object({ versionId: z.uuid() });
const shareLinkParamsSchema = z.object({ shareLinkId: z.uuid() });
const exchangeSchema = z.object({
  token: z.string().min(32).max(200),
});
const createLinkSchema = z.object({
  expiresInHours: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(168)
    .default(Number(process.env.PATIENT_SHARE_TTL_HOURS ?? 72)),
});

function parseOrThrow<T>(
  schema: z.ZodType<T>,
  value: unknown,
  message: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, message);
  }
  return parsed.data;
}

export async function createShareLink(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { versionId } = parseOrThrow(
    versionParamsSchema,
    request.params,
    "Invalid report version ID",
  );
  const { expiresInHours } = parseOrThrow(
    createLinkSchema,
    request.body,
    "Invalid share link settings",
  );
  const link = await sharingService.createShareLink(
    user,
    versionId,
    expiresInHours,
  );
  response
    .set("Cache-Control", "no-store")
    .status(201)
    .json(successResponse(link, "Patient share link created"));
}

export async function revokeShareLink(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { shareLinkId } = parseOrThrow(
    shareLinkParamsSchema,
    request.params,
    "Invalid share link ID",
  );
  await sharingService.revokeShareLink(user, shareLinkId);
  response.json(successResponse({}, "Patient share link revoked"));
}

export async function exchangeToken(request: Request, response: Response) {
  const { token } = parseOrThrow(
    exchangeSchema,
    request.body,
    "Invalid patient share token",
  );
  const access = await sharingService.exchangeToken(token);
  response
    .set("Cache-Control", "no-store")
    .json(successResponse(access, "Patient report access granted"));
}

export async function getPatientPdf(request: Request, response: Response) {
  const access = getPatientAccess(request);
  const { versionId } = parseOrThrow(
    versionParamsSchema,
    request.params,
    "Invalid report version ID",
  );
  if (access.versionId !== versionId) {
    throw new HttpError(404, "Report is not available");
  }
  const pdf = await sharingService.getPatientPdf(
    access.facilityId,
    access.shareLinkId,
    versionId,
  );
  response
    .status(200)
    .set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'inline; filename="radiology-report.pdf"',
      "Content-Type": "application/pdf",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    })
    .send(pdf);
}
