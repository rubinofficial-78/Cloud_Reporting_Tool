import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "./shared/middleware/error_handler.js";
import { failureResponse, successResponse } from "./shared/response_format.js";
import { apiRouter } from "./src/router.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters");
}

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.get("/health", (_request, response) => {
  response.json(successResponse({ status: "ok" }, "Health check passed"));
});
app.use("/api/v1", apiRouter);
app.use("/api/v1", (_request, response) => {
  response.status(404).json(failureResponse("API route not found"));
});
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`Cloud Reporting API listening on port ${port}`);
});
