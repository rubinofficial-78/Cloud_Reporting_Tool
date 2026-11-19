const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const objectNamePattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

export function createPdfObjectName(
  facilityId: string,
  versionId: string,
): string {
  if (!uuidPattern.test(facilityId) || !uuidPattern.test(versionId)) {
    throw new Error("Invalid PDF storage identifier");
  }
  return `${facilityId}/${versionId}.pdf`;
}

export function validatePdfObjectName(objectName: string): string {
  if (!objectNamePattern.test(objectName)) {
    throw new Error("Invalid PDF storage object name");
  }
  return objectName;
}
