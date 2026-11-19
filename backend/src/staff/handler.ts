import type { Request, Response } from "express";
import { z } from "zod";
import { getAuthenticatedUser } from "../../shared/middleware/authentication.js";
import { HttpError } from "../../shared/middleware/http_error.js";
import { successResponse } from "../../shared/response_format.js";
import * as staffService from "./service.js";

export async function listRadiologists(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const radiologists = await staffService.listRadiologists(user.facilityId);
  response.json(successResponse(radiologists, "Radiologists retrieved"));
}

export async function setMembershipStatus(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const userId = z.uuid().safeParse(request.params.userId);
  const body = z.object({ active: z.boolean() }).safeParse(request.body);
  if (!userId.success || !body.success) {
    throw new HttpError(400, "Invalid staff membership status payload");
  }
  const membership = await staffService.setMembershipActive(
    user.facilityId,
    user.userId,
    userId.data,
    body.data.active,
  );
  response.json(successResponse(membership, "Staff membership status updated"));
}
