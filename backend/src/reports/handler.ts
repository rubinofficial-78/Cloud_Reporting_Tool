import type { Request, Response } from "express";
import { z } from "zod";
import { getAuthenticatedUser } from "../../shared/middleware/authentication.js";
import { HttpError } from "../../shared/middleware/http_error.js";
import { successResponse } from "../../shared/response_format.js";
import * as reportService from "./service.js";

const orderParamsSchema = z.object({ orderId: z.uuid() });
const reportParamsSchema = z.object({ reportId: z.uuid() });
const versionParamsSchema = z.object({ versionId: z.uuid() });
const createDraftSchema = z.object({ templateId: z.uuid() });
const saveDraftSchema = z.object({
  content: z.record(z.string(), z.string().max(20_000)).refine(
    (content) => Object.keys(content).length <= 20,
  ),
  amendmentReason: z.string().trim().min(1).max(1000).optional(),
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

export async function createDraft(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { orderId } = parseOrThrow(
    orderParamsSchema,
    request.params,
    "Invalid order ID",
  );
  const { templateId } = parseOrThrow(
    createDraftSchema,
    request.body,
    "Invalid report draft payload",
  );
  const report = await reportService.createDraft(user, orderId, templateId);
  response.status(201).json(successResponse(report, "Report draft created"));
}

export async function getDraft(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { orderId } = parseOrThrow(
    orderParamsSchema,
    request.params,
    "Invalid order ID",
  );
  const report = await reportService.getDraft(user, orderId);
  response.json(successResponse(report, "Report retrieved"));
}

export async function getReportOverview(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { orderId } = parseOrThrow(
    orderParamsSchema,
    request.params,
    "Invalid order ID",
  );
  const overview = await reportService.getReportOverview(user, orderId);
  response.json(successResponse(overview, "Report status retrieved"));
}

export async function saveDraft(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { reportId } = parseOrThrow(
    reportParamsSchema,
    request.params,
    "Invalid report ID",
  );
  const input = parseOrThrow(
    saveDraftSchema,
    request.body,
    "Invalid report draft payload",
  );
  const report = await reportService.saveDraft(user, reportId, input);
  response.json(successResponse(report, "Report draft saved"));
}

export async function signDraft(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { reportId } = parseOrThrow(
    reportParamsSchema,
    request.params,
    "Invalid report ID",
  );
  const version = await reportService.signDraft(user, reportId, "sign");
  response
    .status(202)
    .json(successResponse(version, "Report signed; PDF generation queued"));
}

export async function amendReport(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { reportId } = parseOrThrow(
    reportParamsSchema,
    request.params,
    "Invalid report ID",
  );
  const version = await reportService.signDraft(user, reportId, "amend");
  response
    .status(202)
    .json(successResponse(version, "Report amendment signed; PDF generation queued"));
}

export async function listVersions(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { reportId } = parseOrThrow(
    reportParamsSchema,
    request.params,
    "Invalid report ID",
  );
  const versions = await reportService.listVersions(user, reportId);
  response.json(successResponse(versions, "Report versions retrieved"));
}

export async function getPdf(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { versionId } = parseOrThrow(
    versionParamsSchema,
    request.params,
    "Invalid report version ID",
  );
  const pdf = await reportService.getStaffPdf(user, versionId);
  response
    .status(200)
    .set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'inline; filename="radiology-report.pdf"',
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    })
    .send(pdf);
}
