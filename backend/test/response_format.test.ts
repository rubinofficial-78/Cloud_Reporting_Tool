import assert from "node:assert/strict";
import test from "node:test";
import {
  failureResponse,
  paginatedResponse,
  successResponse,
} from "../shared/response_format.js";

test("success responses use the standard envelope", () => {
  assert.deepEqual(successResponse({ id: "patient-1" }, "Created"), {
    meta: { status: "success", message: "Created" },
    data: { id: "patient-1" },
  });
});

test("failure responses use the standard envelope", () => {
  assert.deepEqual(failureResponse("Not found"), {
    meta: { status: "error", message: "Not found" },
    data: {},
  });
});

test("paginated responses keep rows in data as an array", () => {
  assert.deepEqual(paginatedResponse([{ id: "patient-1" }], "Page loaded"), {
    meta: { status: "success", message: "Page loaded" },
    data: [{ id: "patient-1" }],
  });
});
