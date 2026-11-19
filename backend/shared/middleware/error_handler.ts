import type { ErrorRequestHandler } from "express";
import { failureResponse } from "../response_format.js";
import { HttpError } from "./http_error.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    response
      .status(error.statusCode)
      .json(failureResponse(error.message));
    return;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  ) {
    response.status(400).json(failureResponse("Invalid JSON payload"));
    return;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.too.large"
  ) {
    response.status(413).json(failureResponse("Request payload is too large"));
    return;
  }

  console.error("Unhandled API error", error);
  response
    .status(500)
    .json(failureResponse("An unexpected error occurred"));
};
