import { HttpError } from "../../shared/middleware/http_error.js";
import {
  decodeCursor,
  encodeCursor,
  type CreatedCursor,
} from "../../shared/pagination.js";
import * as patientRepository from "../../shared/repository/patient.repository.js";

interface PatientInput {
  medicalRecordNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | undefined;
}

interface PatientUpdate {
  firstName?: string | undefined;
  lastName?: string | undefined;
  dateOfBirth?: string | undefined;
}

interface PatientListOptions {
  limit: number;
  cursor?: string | undefined;
}

export async function listPatients(
  facilityId: string,
  options: PatientListOptions,
) {
  const cursor = decodeCursor(options.cursor);
  const rows = await patientRepository.listPatients(
    facilityId,
    options.limit + 1,
    cursor,
  );
  const hasMore = rows.length > options.limit;
  const patients = hasMore ? rows.slice(0, options.limit) : rows;
  const lastPatient = patients.at(-1);

  return {
    patients,
    nextCursor:
      hasMore && lastPatient
        ? encodeCursor({
            createdAt: lastPatient.createdAt.toISOString(),
            id: lastPatient.id,
        } satisfies CreatedCursor)
        : undefined,
  };
}

export async function createPatient(
  facilityId: string,
  actorId: string,
  input: PatientInput,
) {
  try {
    const patient = await patientRepository.createPatient(
      facilityId,
      actorId,
      input,
    );
    if (!patient) {
      throw new Error("Patient insert did not return a row");
    }
    return patient;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new HttpError(
        409,
        "A patient with this medical record number already exists",
      );
    }
    throw error;
  }
}

export async function getPatient(facilityId: string, patientId: string) {
  const patient = await patientRepository.getPatient(facilityId, patientId);
  if (!patient) {
    throw new HttpError(404, "Patient not found");
  }
  return patient;
}

export async function updatePatient(
  facilityId: string,
  patientId: string,
  actorId: string,
  input: PatientUpdate,
) {
  const patient = await patientRepository.updatePatient(
    facilityId,
    patientId,
    actorId,
    input,
  );
  if (!patient) {
    throw new HttpError(404, "Patient not found");
  }
  return patient;
}

export async function deletePatient(
  facilityId: string,
  patientId: string,
  actorId: string,
) {
  const deleted = await patientRepository.deletePatient(
    facilityId,
    patientId,
    actorId,
  );
  if (!deleted) {
    throw new HttpError(404, "Patient not found");
  }
}
