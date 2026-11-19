import * as gcsStorage from "./gcs_pdf_storage.js";
import * as localStorage from "./local_pdf_storage.js";
import * as supabaseStorage from "./supabase_pdf_storage.js";

type PdfStorageProvider =
  | "GCP_STORAGE"
  | "SUPABASE_STORAGE"
  | "LOCAL_STORAGE";

function getProvider(): PdfStorageProvider {
  const provider = process.env.STORAGE_TO_USE;
  if (
    provider === "GCP_STORAGE" ||
    provider === "SUPABASE_STORAGE" ||
    provider === "LOCAL_STORAGE"
  ) {
    return provider;
  }
  throw new Error(
    "STORAGE_TO_USE must be GCP_STORAGE, SUPABASE_STORAGE, or LOCAL_STORAGE",
  );
}

export async function writeReportPdf(
  facilityId: string,
  versionId: string,
  bytes: Uint8Array,
): Promise<{ relativePath: string; sha256: string }> {
  switch (getProvider()) {
    case "GCP_STORAGE":
      return gcsStorage.writeReportPdf(facilityId, versionId, bytes);
    case "SUPABASE_STORAGE":
      return supabaseStorage.writeReportPdf(facilityId, versionId, bytes);
    case "LOCAL_STORAGE":
      return localStorage.writeReportPdf(facilityId, versionId, bytes);
  }
}

export async function readReportPdf(relativePath: string): Promise<Buffer> {
  switch (getProvider()) {
    case "GCP_STORAGE":
      return gcsStorage.readReportPdf(relativePath);
    case "SUPABASE_STORAGE":
      return supabaseStorage.readReportPdf(relativePath);
    case "LOCAL_STORAGE":
      return localStorage.readReportPdf(relativePath);
  }
}
