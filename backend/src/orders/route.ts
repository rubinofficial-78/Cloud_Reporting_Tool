import { Router } from "express";
import { asyncHandler } from "../../shared/middleware/async_handler.js";
import {
  authenticate,
  authorizeRoles,
} from "../../shared/middleware/authentication.js";
import {
  assignRadiologist,
  cancelOrder,
  createOrder,
  getOrder,
  listOrders,
  startOrder,
} from "./handler.js";

export const orderRoutes = Router();

orderRoutes.use(authenticate);
orderRoutes.get("/", asyncHandler(listOrders));
orderRoutes.post(
  "/",
  authorizeRoles("front_desk", "facility_admin"),
  asyncHandler(createOrder),
);
orderRoutes.get("/:orderId", asyncHandler(getOrder));
orderRoutes.patch(
  "/:orderId/assignment",
  authorizeRoles("front_desk", "facility_admin"),
  asyncHandler(assignRadiologist),
);
orderRoutes.post(
  "/:orderId/start",
  authorizeRoles("radiologist", "facility_admin"),
  asyncHandler(startOrder),
);
orderRoutes.post(
  "/:orderId/cancel",
  authorizeRoles("front_desk", "facility_admin"),
  asyncHandler(cancelOrder),
);
