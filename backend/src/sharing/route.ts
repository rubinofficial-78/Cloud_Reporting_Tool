import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { asyncHandler } from "../../shared/middleware/async_handler.js";
import {
  authenticate,
  authorizeRoles,
} from "../../shared/middleware/authentication.js";
import { authenticatePatientAccess } from "../../shared/middleware/patient_access.js";
import {
  createShareLink,
  exchangeToken,
  getPatientPdf,
  revokeShareLink,
} from "./handler.js";

export const sharingRoutes = Router();

const publicAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

sharingRoutes.post(
  "/report-versions/:versionId/share-links",
  authenticate,
  authorizeRoles("front_desk", "radiologist", "facility_admin"),
  asyncHandler(createShareLink),
);
sharingRoutes.delete(
  "/share-links/:shareLinkId",
  authenticate,
  authorizeRoles("front_desk", "facility_admin"),
  asyncHandler(revokeShareLink),
);
sharingRoutes.post(
  "/public/report-access/exchange",
  publicAccessLimiter,
  asyncHandler(exchangeToken),
);
sharingRoutes.get(
  "/public/report-access/reports/:versionId/pdf",
  publicAccessLimiter,
  authenticatePatientAccess,
  asyncHandler(getPatientPdf),
);
