import type { Request, Response } from "express";
import { z } from "zod";
import {
  paginatedResponse,
  successResponse,
} from "../../shared/response_format.js";
import { HttpError } from "../../shared/middleware/http_error.js";
import { getAuthenticatedUser } from "../../shared/middleware/authentication.js";
import * as patientService from "./service.js";

const createPatientSchema = z.object({
  medicalRecordNumber: z.string().trim().min(1).max(64),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  dateOfBirth: z.iso.date().optional(),
});

const updatePatientSchema = createPatientSchema
  .omit({ medicalRecordNumber: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0);

const patientIdSchema = z.object({
  patientId: z.uuid(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional().transform((value) => value ?? undefined),
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

export async function listPatients(
  request: Request,
  response: Response,
): Promise<void> {
  const user = getAuthenticatedUser(request);
  const query = parseOrThrow(
    listQuerySchema,
    request.query,
    "Invalid pagination parameters",
  );
  const result = await patientService.listPatients(user.facilityId, query);

  if (result.nextCursor) {
    response.setHeader("X-Next-Cursor", result.nextCursor);
  }
  response.json(paginatedResponse(result.patients, "Patients retrieved"));
}

export async function createPatient(
  request: Request,
  response: Response,
): Promise<void> {
  const user = getAuthenticatedUser(request);
  const input = parseOrThrow(
    createPatientSchema,
    request.body,
    "Invalid patient payload",
  );
  const patient = await patientService.createPatient(
    user.facilityId,
    user.userId,
    input,
  );
  response
    .status(201)
    .json(successResponse(patient, "Patient created"));
}

export async function getPatient(
  request: Request,
  response: Response,
): Promise<void> {
  const user = getAuthenticatedUser(request);
  const { patientId } = parseOrThrow(
    patientIdSchema,
    request.params,
    "Invalid patient ID",
  );
  const patient = await patientService.getPatient(user.facilityId, patientId);
  response.json(successResponse(patient, "Patient retrieved"));
}

export async function updatePatient(
  request: Request,
  response: Response,
): Promise<void> {
  const user = getAuthenticatedUser(request);
  const { patientId } = parseOrThrow(
    patientIdSchema,
    request.params,
    "Invalid patient ID",
  );
  const input = parseOrThrow(
    updatePatientSchema,
    request.body,
    "Invalid patient update payload",
  );
  const patient = await patientService.updatePatient(
    user.facilityId,
    patientId,
    user.userId,
    input,
  );
  response.json(successResponse(patient, "Patient updated"));
}

export async function deletePatient(
  request: Request,
  response: Response,
): Promise<void> {
  const user = getAuthenticatedUser(request);
  const { patientId } = parseOrThrow(
    patientIdSchema,
    request.params,
    "Invalid patient ID",
  );
  await patientService.deletePatient(user.facilityId, patientId, user.userId);
  response.json(successResponse({}, "Patient deleted"));
}
