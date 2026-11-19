import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/async_handler.js";
import {
  authenticate,
  authorizeRoles,
} from "../../shared/middleware/authentication.js";
import { createTemplate, listTemplates } from "./handler.js";

export const reportTemplateRoutes = Router();

reportTemplateRoutes.use(authenticate);
reportTemplateRoutes.get("/", asyncHandler(listTemplates));
reportTemplateRoutes.post(
  "/",
  authorizeRoles("facility_admin"),
  asyncHandler(createTemplate),
);
