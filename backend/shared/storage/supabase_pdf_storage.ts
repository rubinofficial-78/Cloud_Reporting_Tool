import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createPdfObjectName, validatePdfObjectName } from "./pdf_object_name.js";

let client: SupabaseClient | undefined;

function getBucket() {
  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const bucketName = process.env.SUPABASE_BUCKET_NAME?.trim();
  if (!url || !bucketName) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_BUCKET_NAME must be set for Supabase PDF storage",
    );
  }
  if (
    !secretKey ||
    secretKey === "your_new_secret_key" ||
    secretKey === "replace-with-your-supabase-secret-key"
  ) {
    throw new Error(
      "SUPABASE_SECRET_KEY must be set to a valid Supabase project secret key",
    );
  }
  client ??= createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  return client.storage.from(bucketName);
}

export async function writeReportPdf(
  facilityId: string,
  versionId: string,
  bytes: Uint8Array,
): Promise<{ relativePath: string; sha256: string }> {
  const objectName = createPdfObjectName(facilityId, versionId);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const { error } = await getBucket().upload(objectName, Buffer.from(bytes), {
    cacheControl: "0",
    contentType: "application/pdf",
    metadata: { sha256 },
    upsert: true,
  });
  if (error) {
    throw error;
  }
  return { relativePath: objectName, sha256 };
}

export async function readReportPdf(objectName: string): Promise<Buffer> {
  const { data, error } = await getBucket().download(
    validatePdfObjectName(objectName),
  );
  if (error) {
    throw error;
  }
  return Buffer.from(await data.arrayBuffer());
}
