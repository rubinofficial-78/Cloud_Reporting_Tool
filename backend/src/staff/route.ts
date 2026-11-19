import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/async_handler.js";
import {
  authenticate,
  authorizeRoles,
} from "../../shared/middleware/authentication.js";
import { listRadiologists, setMembershipStatus } from "./handler.js";

export const staffRoutes = Router();

staffRoutes.use(authenticate);
staffRoutes.get("/radiologists", asyncHandler(listRadiologists));
staffRoutes.patch(
  "/:userId/status",
  authorizeRoles("facility_admin"),
  asyncHandler(setMembershipStatus),
);
