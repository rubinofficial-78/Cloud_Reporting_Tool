import { Router } from "express";
import { authRoutes } from "./auth/route.js";
import { orderRoutes } from "./orders/route.js";
import { patientRoutes } from "./patients/route.js";
import { reportTemplateRoutes } from "./report-templates/route.js";
import { reportRoutes } from "./reports/route.js";
import { sharingRoutes } from "./sharing/route.js";
import { staffRoutes } from "./staff/route.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/patients", patientRoutes);
apiRouter.use("/orders", orderRoutes);
apiRouter.use("/report-templates", reportTemplateRoutes);
apiRouter.use(reportRoutes);
apiRouter.use(sharingRoutes);
apiRouter.use("/staff", staffRoutes);
