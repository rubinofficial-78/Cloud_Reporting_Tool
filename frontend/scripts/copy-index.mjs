import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const distDirectory = new URL("../dist/", import.meta.url);
await mkdir(distDirectory, { recursive: true });
await mkdir(new URL("../dist/assets/", import.meta.url), { recursive: true });
await copyFile(
  fileURLToPath(new URL("../index.html", import.meta.url)),
  fileURLToPath(new URL("../dist/index.html", import.meta.url)),
);
await copyFile(
  fileURLToPath(new URL("../../backend/assets/5c-networks-logo.png", import.meta.url)),
  fileURLToPath(new URL("../dist/assets/5c-networks-logo.png", import.meta.url)),
);
const appConfig = {
  apiBaseUrl:
    process.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1",
  defaultFacilityId: process.env.VITE_DEFAULT_FACILITY_ID ?? "",
};
await writeFile(
  fileURLToPath(new URL("../dist/config.js", import.meta.url)),
  `window.__CLOUD_REPORTING_CONFIG__ = ${JSON.stringify(appConfig)};\n`,
);
