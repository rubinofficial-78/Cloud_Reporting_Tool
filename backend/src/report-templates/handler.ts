import type { Request, Response } from "express";
import { z } from "zod";
import { getAuthenticatedUser } from "../../shared/middleware/authentication.js";
import { HttpError } from "../../shared/middleware/http_error.js";
import { successResponse } from "../../shared/response_format.js";
import * as templateService from "./service.js";

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  sections: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
        label: z.string().trim().min(1).max(120),
        required: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(20)
    .refine((sections) => new Set(sections.map(({ key }) => key)).size === sections.length),
});

export async function listTemplates(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const templates = await templateService.listTemplates(user.facilityId);
  response.json(successResponse(templates, "Report templates retrieved"));
}

export async function createTemplate(request: Request, response: Response) {
  const user = getAuthenticatedUser(request);
  const input = createTemplateSchema.safeParse(request.body);
  if (!input.success) {
    throw new HttpError(400, "Invalid report template payload");
  }

  const template = await templateService.createTemplate(
    user.facilityId,
    user.userId,
    input.data.name,
    input.data.sections,
  );
  response
    .status(201)
    .json(successResponse(template, "Report template created"));
}
