import { createHash } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import { JWT } from "google-auth-library";
import {
  createPdfObjectName,
  validatePdfObjectName,
} from "./pdf_object_name.js";

let storage: Storage | undefined;

function getBucket() {
  const bucketName = process.env.GCS_BUCKET_NAME?.trim();
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME must be set for GCS PDF storage");
  }
  if (!keyFilename) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS must point to a service-account key file",
    );
  }
  storage ??= new Storage({
    authClient: new JWT({
      keyFile: keyFilename,
      scopes: ["https://www.googleapis.com/auth/devstorage.read_write"],
    }),
  });
  return storage.bucket(bucketName);
}

export async function writeReportPdf(
  facilityId: string,
  versionId: string,
  bytes: Uint8Array,
): Promise<{ relativePath: string; sha256: string }> {
  const objectName = createPdfObjectName(facilityId, versionId);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await getBucket().file(objectName).save(Buffer.from(bytes), {
    resumable: false,
    metadata: {
      cacheControl: "private, no-store",
      contentType: "application/pdf",
      metadata: { sha256 },
    },
  });
  return { relativePath: objectName, sha256 };
}

export async function readReportPdf(objectName: string): Promise<Buffer> {
  const [bytes] = await getBucket()
    .file(validatePdfObjectName(objectName))
    .download();
  return bytes;
}
