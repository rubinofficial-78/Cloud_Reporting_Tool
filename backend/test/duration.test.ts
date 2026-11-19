import assert from "node:assert/strict";
import test from "node:test";
import { durationSeconds, shareLinkDurationHours } from "../shared/duration.js";
import { HttpError } from "../shared/middleware/http_error.js";

test("duration parser converts supported units and enforces a maximum", () => {
  assert.equal(durationSeconds("15m", "TEST_TTL", 3600), 900);
  assert.throws(
    () => durationSeconds("2h", "TEST_TTL", 3600),
    /exceeds its maximum/,
  );
  assert.throws(() => durationSeconds("0m", "TEST_TTL", 3600), /positive/);
});

test("share-link lifetimes are limited to one week", () => {
  assert.equal(shareLinkDurationHours(72), 72);
  assert.throws(() => shareLinkDurationHours(0), HttpError);
  assert.throws(() => shareLinkDurationHours(169), HttpError);
});
