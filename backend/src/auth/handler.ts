import type { Request, Response } from "express";
import { z } from "zod";
import { getAuthenticatedUser } from "../../shared/middleware/authentication.js";
import { HttpError } from "../../shared/middleware/http_error.js";
import { successResponse } from "../../shared/response_format.js";
import * as authService from "./service.js";

const loginSchema = z.object({
  email: z.email().max(320).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(200),
  facilityId: z.uuid(),
});

export async function login(request: Request, response: Response) {
  const input = loginSchema.safeParse(request.body);
  if (!input.success) {
    throw new HttpError(400, "Invalid login payload");
  }

  const result = await authService.login(input.data);
  response.json(successResponse(result, "Login successful"));
}

export function currentUser(request: Request, response: Response) {
  response.json(
    successResponse(getAuthenticatedUser(request), "Current user retrieved"),
  );
}
