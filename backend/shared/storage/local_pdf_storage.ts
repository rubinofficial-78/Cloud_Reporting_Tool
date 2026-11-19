import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve, sep } from "node:path";

const storageRoot = resolve(
  process.env.PDF_STORAGE_DIR ?? "./storage/reports",
);

function assertUuid(value: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error("Invalid PDF storage identifier");
  }
}

function resolveStoredPath(relativePath: string): string {
  if (isAbsolute(relativePath)) {
    throw new Error("PDF storage path must be relative");
  }
  const resolved = resolve(storageRoot, relativePath);
  if (!resolved.startsWith(`${storageRoot}${sep}`)) {
    throw new Error("PDF storage path is outside the configured directory");
  }
  return resolved;
}

export async function writeReportPdf(
  facilityId: string,
  versionId: string,
  bytes: Uint8Array,
): Promise<{ relativePath: string; sha256: string }> {
  assertUuid(facilityId);
  assertUuid(versionId);
  const relativePath = `${facilityId}/${versionId}.pdf`;
  const targetPath = resolveStoredPath(relativePath);
  const temporaryPath = `${targetPath}.${randomUUID()}.tmp`;
  await mkdir(dirname(targetPath), { recursive: true, mode: 0o700 });
  await writeFile(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
  await rename(temporaryPath, targetPath);

  return {
    relativePath,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function readReportPdf(relativePath: string): Promise<Buffer> {
  return readFile(resolveStoredPath(relativePath));
}
