import "dotenv/config";
import { startPdfWorker } from "./src/jobs/pdf_worker.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to at least 32 characters");
}

await startPdfWorker();
