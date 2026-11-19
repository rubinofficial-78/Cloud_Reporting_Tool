import {
  and,
  desc,
  eq,
  isNull,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "../db/connection.js";
import { auditEvents, patients } from "../db/schema.js";

interface PatientCursor {
  createdAt: string;
  id: string;
}

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

export async function listPatients(
  facilityId: string,
  limit: number,
  cursor?: PatientCursor,
) {
  const conditions: SQL[] = [
    eq(patients.facilityId, facilityId),
    isNull(patients.deletedAt),
  ];
  if (cursor) {
    const cursorDate = new Date(cursor.createdAt);
    conditions.push(
      or(
        lt(patients.createdAt, cursorDate),
        and(eq(patients.createdAt, cursorDate), lt(patients.id, cursor.id)),
      )!,
    );
  }

  return db
    .select()
    .from(patients)
    .where(and(...conditions))
    .orderBy(desc(patients.createdAt), desc(patients.id))
    .limit(limit);
}

export async function createPatient(
  facilityId: string,
  actorId: string,
  input: PatientInput,
) {
  return db.transaction(async (tx) => {
    const [patient] = await tx
      .insert(patients)
      .values({
        facilityId,
        medicalRecordNumber: input.medicalRecordNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
      })
      .returning();
    if (!patient) {
      throw new Error("Patient insert did not return a row");
    }
    await tx.insert(auditEvents).values({
      facilityId,
      actorUserId: actorId,
      action: "patient.created",
      resourceType: "patient",
      resourceId: patient.id,
      metadata: {},
    });
    return patient;
  });
}

export async function getPatient(facilityId: string, patientId: string) {
  const [patient] = await db
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.facilityId, facilityId),
        eq(patients.id, patientId),
        isNull(patients.deletedAt),
      ),
    )
    .limit(1);
  return patient;
}

export async function updatePatient(
  facilityId: string,
  patientId: string,
  actorId: string,
  input: PatientUpdate,
) {
  return db.transaction(async (tx) => {
    const [patient] = await tx
      .update(patients)
      .set({ ...input, updatedAt: new Date() })
      .where(
        and(
          eq(patients.facilityId, facilityId),
          eq(patients.id, patientId),
          isNull(patients.deletedAt),
        ),
      )
      .returning();
    if (patient) {
      await tx.insert(auditEvents).values({
        facilityId,
        actorUserId: actorId,
        action: "patient.updated",
        resourceType: "patient",
        resourceId: patientId,
        metadata: {},
      });
    }
    return patient;
  });
}

export async function deletePatient(
  facilityId: string,
  patientId: string,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [patient] = await tx
      .update(patients)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(patients.facilityId, facilityId),
          eq(patients.id, patientId),
          isNull(patients.deletedAt),
        ),
      )
      .returning({ id: patients.id });
    if (patient) {
      await tx.insert(auditEvents).values({
        facilityId,
        actorUserId: actorId,
        action: "patient.archived",
        resourceType: "patient",
        resourceId: patientId,
        metadata: {},
      });
    }
    return patient;
  });
}
