import { HttpError } from "./middleware/http_error.js";

export interface CreatedCursor {
  createdAt: string;
  id: string;
}

export function encodeCursor(cursor: CreatedCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeCursor(value: string | undefined): CreatedCursor | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.id !== "string" ||
      Number.isNaN(Date.parse(parsed.createdAt)) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        parsed.id,
      )
    ) {
      throw new Error("Malformed cursor");
    }

    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new HttpError(400, "Invalid pagination cursor");
  }
}
