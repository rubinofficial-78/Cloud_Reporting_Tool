import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { asyncHandler } from "../../shared/middleware/async_handler.js";
import { authenticate } from "../../shared/middleware/authentication.js";
import { currentUser, login } from "./handler.js";

export const authRoutes = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

authRoutes.post("/login", loginLimiter, asyncHandler(login));
authRoutes.get("/me", authenticate, currentUser);
