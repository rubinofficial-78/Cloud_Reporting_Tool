import {
  and,
  desc,
  eq,
  ilike,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  facilityMemberships,
  auditEvents,
  orders,
  orderPriority,
  orderStatus,
  patients,
  scanModality,
  users,
} from "../db/schema.js";

type OrderStatus = (typeof orderStatus.enumValues)[number];
type OrderModality = (typeof scanModality.enumValues)[number];
type OrderPriority = (typeof orderPriority.enumValues)[number];

interface OrderCursor {
  createdAt: string;
  id: string;
}

interface OrderFilters {
  status?: OrderStatus | undefined;
  modality?: OrderModality | undefined;
  assigneeId?: string | undefined;
  query?: string | undefined;
}

interface CreateOrderInput {
  patientId: string;
  accessionNumber: string;
  modality: OrderModality;
  procedureName: string;
  priority: OrderPriority;
  createdBy: string;
}

export async function listOrders(
  facilityId: string,
  limit: number,
  filters: OrderFilters,
  cursor?: OrderCursor,
) {
  const conditions: SQL[] = [eq(orders.facilityId, facilityId)];
  if (filters.status) {
    conditions.push(eq(orders.status, filters.status));
  }
  if (filters.modality) {
    conditions.push(eq(orders.modality, filters.modality));
  }
  if (filters.assigneeId) {
    conditions.push(eq(orders.assignedRadiologistId, filters.assigneeId));
  }
  if (filters.query) {
    const term = filters.query.trim();
    conditions.push(
      term.length >= 3
        ? or(
            ilike(orders.accessionNumber, `%${term}%`),
            ilike(patients.medicalRecordNumber, `%${term}%`),
            ilike(patients.firstName, `%${term}%`),
            ilike(patients.lastName, `%${term}%`),
          )!
        : or(
            eq(orders.accessionNumber, term),
            eq(patients.medicalRecordNumber, term),
          )!,
    );
  }
  if (cursor) {
    const cursorDate = new Date(cursor.createdAt);
    conditions.push(
      or(
        lt(orders.createdAt, cursorDate),
        and(eq(orders.createdAt, cursorDate), lt(orders.id, cursor.id)),
      )!,
    );
  }

  return db
    .select({
      order: orders,
      patient: {
        id: patients.id,
        medicalRecordNumber: patients.medicalRecordNumber,
        firstName: patients.firstName,
        lastName: patients.lastName,
        dateOfBirth: patients.dateOfBirth,
      },
    })
    .from(orders)
    .innerJoin(
      patients,
      and(
        eq(patients.facilityId, orders.facilityId),
        eq(patients.id, orders.patientId),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(limit);
}

export async function getOrder(facilityId: string, orderId: string) {
  const [result] = await db
    .select({
      order: orders,
      patient: {
        id: patients.id,
        medicalRecordNumber: patients.medicalRecordNumber,
        firstName: patients.firstName,
        lastName: patients.lastName,
        dateOfBirth: patients.dateOfBirth,
      },
    })
    .from(orders)
    .innerJoin(
      patients,
      and(
        eq(patients.facilityId, orders.facilityId),
        eq(patients.id, orders.patientId),
      ),
    )
    .where(and(eq(orders.facilityId, facilityId), eq(orders.id, orderId)))
    .limit(1);
  return result;
}

export async function createOrder(
  facilityId: string,
  input: CreateOrderInput,
) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        facilityId,
        patientId: input.patientId,
        accessionNumber: input.accessionNumber,
        modality: input.modality,
        procedureName: input.procedureName,
        priority: input.priority,
        createdBy: input.createdBy,
      })
      .returning();
    if (!order) {
      throw new Error("Order insert did not return a row");
    }
    await tx.insert(auditEvents).values({
      facilityId,
      actorUserId: input.createdBy,
      action: "order.created",
      resourceType: "order",
      resourceId: order.id,
      metadata: { modality: order.modality },
    });
    return order;
  });
}

export async function isRadiologist(
  facilityId: string,
  userId: string,
): Promise<boolean> {
  const [membership] = await db
    .select({ id: facilityMemberships.id })
    .from(facilityMemberships)
    .innerJoin(users, eq(users.id, facilityMemberships.userId))
    .where(
      and(
        eq(facilityMemberships.facilityId, facilityId),
        eq(facilityMemberships.userId, userId),
        eq(facilityMemberships.role, "radiologist"),
        eq(facilityMemberships.active, true),
        eq(users.active, true),
      ),
    )
    .limit(1);
  return Boolean(membership);
}

export async function assignRadiologist(
  facilityId: string,
  orderId: string,
  radiologistId: string,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.facilityId, facilityId), eq(orders.id, orderId)))
      .for("update")
      .limit(1);
    if (!order) {
      return undefined;
    }
    if (order.status === "reported" || order.status === "cancelled") {
      return null;
    }

    const [updated] = await tx
      .update(orders)
      .set({
        assignedRadiologistId: radiologistId,
        status: order.status === "in_progress" ? "in_progress" : "assigned",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId))
      .returning();
    await tx.insert(auditEvents).values({
      facilityId,
      actorUserId: actorId,
      action: "order.assigned",
      resourceType: "order",
      resourceId: orderId,
      metadata: { radiologistId },
    });
    return updated;
  });
}

export async function updateOrderStatus(
  facilityId: string,
  orderId: string,
  expectedStatus: OrderStatus,
  nextStatus: OrderStatus,
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.facilityId, facilityId), eq(orders.id, orderId)))
      .for("update")
      .limit(1);
    if (!current) {
      return undefined;
    }
    if (current.status !== expectedStatus) {
      return null;
    }
    const [order] = await tx
      .update(orders)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    await tx.insert(auditEvents).values({
      facilityId,
      actorUserId: actorId,
      action: `order.${nextStatus}`,
      resourceType: "order",
      resourceId: orderId,
      metadata: { previousStatus: current.status },
    });
    return order;
  });
}
