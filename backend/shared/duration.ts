import { HttpError } from "./middleware/http_error.js";

export function durationSeconds(
  value: string,
  name: string,
  maximumSeconds: number,
): number {
  const match = /^([1-9]\d*)(s|m|h|d)$/.exec(value);
  if (!match) {
    throw new Error(`${name} must be a positive s, m, h, or d duration`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier =
    unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  const seconds = amount * multiplier;
  if (!Number.isSafeInteger(seconds) || seconds > maximumSeconds) {
    throw new Error(`${name} exceeds its maximum duration`);
  }
  return seconds;
}

export function shareLinkDurationHours(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 168) {
    throw new HttpError(400, "Share links may expire between 1 and 168 hours");
  }
  return value;
}
