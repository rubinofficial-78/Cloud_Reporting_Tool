import type { Request, Response } from "express";
import { z } from "zod";
import {
  orderPriority,
  orderStatus,
  scanModality,
} from "../../shared/db/schema.js";
import { getAuthenticatedUser } from "../../shared/middleware/authentication.js";
import { HttpError } from "../../shared/middleware/http_error.js";
import {
  paginatedResponse,
  successResponse,
} from "../../shared/response_format.js";
import * as orderService from "./service.js";

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().min(1).optional(),
  status: z.enum(orderStatus.enumValues).optional(),
  modality: z.enum(scanModality.enumValues).optional(),
  assigneeId: z.uuid().optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

const orderIdSchema = z.object({ orderId: z.uuid() });

const createSchema = z.object({
  patientId: z.uuid(),
  modality: z.enum(scanModality.enumValues),
  procedureName: z.string().trim().min(1).max(200),
  priority: z.enum(orderPriority.enumValues).default("routine"),
});

const assignmentSchema = z.object({ radiologistId: z.uuid() });

function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, message);
  }
  return parsed.data;
}

export async function listOrders(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const filters = parseOrThrow(listSchema, request.query, "Invalid order filters");
  const result = await orderService.listOrders(user, {
    limit: filters.limit,
    cursor: filters.cursor,
    status: filters.status,
    modality: filters.modality,
    assigneeId: filters.assigneeId,
    query: filters.q,
  });
  if (result.nextCursor) {
    response.setHeader("X-Next-Cursor", result.nextCursor);
  }
  response.json(paginatedResponse(result.orders, "Orders retrieved"));
}

export async function getOrder(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { orderId } = parseOrThrow(
    orderIdSchema,
    request.params,
    "Invalid order ID",
  );
  const order = await orderService.getOrderForUser(user, orderId);
  response.json(successResponse(order, "Order retrieved"));
}

export async function createOrder(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const input = parseOrThrow(createSchema, request.body, "Invalid order payload");
  const order = await orderService.createOrder(
    user.facilityId,
    user.userId,
    input,
  );
  response.status(201).json(successResponse(order, "Order created"));
}

export async function assignRadiologist(
  request: Request,
  response: Response,
) {
  const user = getAuthenticatedUser(request);
  const { orderId } = parseOrThrow(
    orderIdSchema,
    request.params,
    "Invalid order ID",
  );
  const { radiologistId } = parseOrThrow(
    assignmentSchema,
    request.body,
    "Invalid assignment payload",
  );
  const order = await orderService.assignRadiologist(
    user.facilityId,
    orderId,
    user.userId,
    radiologistId,
  );
  response.json(successResponse(order, "Order assigned"));
}

export async function startOrder(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { orderId } = parseOrThrow(
    orderIdSchema,
    request.params,
    "Invalid order ID",
  );
  const order = await orderService.startOrder(user, orderId);
  response.json(successResponse(order, "Order started"));
}

export async function cancelOrder(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const { orderId } = parseOrThrow(
    orderIdSchema,
    request.params,
    "Invalid order ID",
  );
  const order = await orderService.cancelOrder(
    user.facilityId,
    orderId,
    user.userId,
  );
  response.json(successResponse(order, "Order cancelled"));
}
