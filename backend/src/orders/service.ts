import { randomBytes } from "node:crypto";
import { HttpError } from "../../shared/middleware/http_error.js";
import {
  decodeCursor,
  encodeCursor,
  type CreatedCursor,
} from "../../shared/pagination.js";
import type { AuthenticatedUser } from "../../shared/middleware/authentication.js";
import * as orderRepository from "../../shared/repository/order.repository.js";
import * as patientRepository from "../../shared/repository/patient.repository.js";

interface OrderFilters {
  status?: "unassigned" | "assigned" | "in_progress" | "reported" | "cancelled" | undefined;
  modality?: "XR" | "CT" | "MRI" | "PET" | "US" | "OTHER" | undefined;
  assigneeId?: string | undefined;
  query?: string | undefined;
  limit: number;
  cursor?: string | undefined;
}

interface CreateOrderInput {
  patientId: string;
  modality: "XR" | "CT" | "MRI" | "PET" | "US" | "OTHER";
  procedureName: string;
  priority: "routine" | "urgent" | "stat";
}

export async function listOrders(
  user: AuthenticatedUser,
  filters: OrderFilters,
) {
  const cursor = decodeCursor(filters.cursor);
  const rows = await orderRepository.listOrders(
    user.facilityId,
    filters.limit + 1,
    {
      status: filters.status,
      modality: filters.modality,
      assigneeId:
        user.role === "radiologist" ? user.userId : filters.assigneeId,
      query: filters.query,
    },
    cursor,
  );
  const hasMore = rows.length > filters.limit;
  const entries = hasMore ? rows.slice(0, filters.limit) : rows;
  const lastOrder = entries.at(-1)?.order;

  return {
    orders: entries,
    nextCursor:
      hasMore && lastOrder
        ? encodeCursor({
            createdAt: lastOrder.createdAt.toISOString(),
            id: lastOrder.id,
          } satisfies CreatedCursor)
        : undefined,
  };
}

export async function getOrder(facilityId: string, orderId: string) {
  const result = await orderRepository.getOrder(facilityId, orderId);
  if (!result) {
    throw new HttpError(404, "Order not found");
  }
  return result;
}

export async function getOrderForUser(
  user: AuthenticatedUser,
  orderId: string,
) {
  const result = await getOrder(user.facilityId, orderId);
  if (
    user.role === "radiologist" &&
    result.order.assignedRadiologistId !== user.userId
  ) {
    throw new HttpError(404, "Order not found");
  }
  return result;
}

export async function createOrder(
  facilityId: string,
  createdBy: string,
  input: CreateOrderInput,
) {
  const patient = await patientRepository.getPatient(facilityId, input.patientId);
  if (!patient) {
    throw new HttpError(404, "Patient not found");
  }

  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const accessionNumber = `ORD-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
  return orderRepository.createOrder(facilityId, {
    ...input,
    accessionNumber,
    createdBy,
  });
}

export async function assignRadiologist(
  facilityId: string,
  orderId: string,
  actorId: string,
  radiologistId: string,
) {
  if (!(await orderRepository.isRadiologist(facilityId, radiologistId))) {
    throw new HttpError(400, "Selected user is not a radiologist at this facility");
  }
  const order = await orderRepository.assignRadiologist(
    facilityId,
    orderId,
    radiologistId,
    actorId,
  );
  if (order === undefined) {
    throw new HttpError(404, "Order not found");
  }
  if (order === null) {
    throw new HttpError(409, "This order cannot be assigned in its current state");
  }
  return order;
}

export async function startOrder(
  user: AuthenticatedUser,
  orderId: string,
) {
  const current = await orderRepository.getOrder(user.facilityId, orderId);
  if (!current) {
    throw new HttpError(404, "Order not found");
  }
  if (
    user.role !== "facility_admin" &&
    current.order.assignedRadiologistId !== user.userId
  ) {
    throw new HttpError(403, "Order is assigned to another radiologist");
  }
  const order = await orderRepository.updateOrderStatus(
    user.facilityId,
    orderId,
    "assigned",
    "in_progress",
    user.userId,
  );
  if (!order) {
    throw new HttpError(409, "Order is not in an assignable state");
  }
  return order;
}

export async function cancelOrder(
  facilityId: string,
  orderId: string,
  actorId: string,
) {
  const current = await orderRepository.getOrder(facilityId, orderId);
  if (!current) {
    throw new HttpError(404, "Order not found");
  }
  if (current.order.status !== "unassigned" && current.order.status !== "assigned") {
    throw new HttpError(409, "Only unstarted orders can be cancelled");
  }
  const order = await orderRepository.updateOrderStatus(
    facilityId,
    orderId,
    current.order.status,
    "cancelled",
    actorId,
  );
  if (!order) {
    throw new HttpError(409, "Order changed while it was being cancelled");
  }
  return order;
}
