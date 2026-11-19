import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/async_handler.js";
import {
  authenticate,
  authorizeRoles,
} from "../../shared/middleware/authentication.js";
import {
  amendReport,
  createDraft,
  getDraft,
  getPdf,
  getReportOverview,
  listVersions,
  saveDraft,
  signDraft,
} from "./handler.js";

export const reportRoutes = Router();

reportRoutes.post(
  "/orders/:orderId/report",
  authenticate,
  authorizeRoles("radiologist", "facility_admin"),
  asyncHandler(createDraft),
);
reportRoutes.get(
  "/orders/:orderId/report",
  authenticate,
  asyncHandler(getDraft),
);
reportRoutes.get(
  "/orders/:orderId/report/status",
  authenticate,
  asyncHandler(getReportOverview),
);
reportRoutes.put(
  "/reports/:reportId/draft",
  authenticate,
  authorizeRoles("radiologist", "facility_admin"),
  asyncHandler(saveDraft),
);
reportRoutes.post(
  "/reports/:reportId/sign",
  authenticate,
  authorizeRoles("radiologist", "facility_admin"),
  asyncHandler(signDraft),
);
reportRoutes.post(
  "/reports/:reportId/amend",
  authenticate,
  authorizeRoles("radiologist", "facility_admin"),
  asyncHandler(amendReport),
);
reportRoutes.get(
  "/reports/:reportId/versions",
  authenticate,
  asyncHandler(listVersions),
);
reportRoutes.get(
  "/report-versions/:versionId/pdf",
  authenticate,
  asyncHandler(getPdf),
);
