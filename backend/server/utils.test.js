/**
 * Unit tests for backend/server/utils.js
 * Run: node --test backend/server/utils.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert";
import { toId, isConnectionError } from "./utils.js";

describe("toId", () => {
  it("returns string for number", () => {
    assert.strictEqual(toId(1), "1");
    assert.strictEqual(toId(0), "0");
  });
  it("returns string for string input", () => {
    assert.strictEqual(toId("abc"), "abc");
  });
  it("returns null for null and undefined", () => {
    assert.strictEqual(toId(null), null);
    assert.strictEqual(toId(undefined), null);
  });
});

describe("isConnectionError", () => {
  it("returns true for ETIMEDOUT", () => {
    assert.strictEqual(isConnectionError({ message: "connect ETIMEDOUT" }), true);
  });
  it("returns true for ECONNREFUSED", () => {
    assert.strictEqual(isConnectionError({ code: "ECONNREFUSED" }), true);
  });
  it("returns true for ENOTFOUND", () => {
    assert.strictEqual(isConnectionError({ message: "getaddrinfo ENOTFOUND" }), true);
  });
  it("returns false for generic error", () => {
    assert.strictEqual(isConnectionError(new Error("Something else")), false);
  });
  it("handles null/undefined safely", () => {
    assert.strictEqual(isConnectionError(null), false);
    assert.strictEqual(isConnectionError(undefined), false);
  });
});
