import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/async_handler.js";
import {
  authenticate,
  authorizeRoles,
} from "../../shared/middleware/authentication.js";
import {
  createPatient,
  deletePatient,
  getPatient,
  listPatients,
  updatePatient,
} from "./handler.js";

export const patientRoutes = Router();

patientRoutes.use(authenticate);
patientRoutes.use(authorizeRoles("front_desk", "facility_admin"));
patientRoutes.get("/", asyncHandler(listPatients));
patientRoutes.post("/", asyncHandler(createPatient));
patientRoutes.get("/:patientId", asyncHandler(getPatient));
patientRoutes.patch("/:patientId", asyncHandler(updatePatient));
patientRoutes.delete("/:patientId", asyncHandler(deletePatient));
