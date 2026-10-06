import assert from "node:assert/strict";
import { test } from "node:test";
import { CompareApi } from "../dist/domains/compare/CompareApi.js";

function brokerHarness(commandTimeoutMs = 100) {
  const handlers = new Map();
  const sent = [];
  const broker = {
    on(type, handler) {
      const listeners = handlers.get(type) ?? new Set();
      listeners.add(handler);
      handlers.set(type, listeners);
      return () => listeners.delete(handler);
    },
    send(type, payload) {
      sent.push({ type, payload });
    }
  };
  const emit = (type, payload) => {
    for (const handler of handlers.get(type) ?? []) handler({ type, payload });
  };
  const api = new CompareApi({
    getBroker: () => broker,
    getIsReady: () => true,
    commandTimeoutMs
  });
  api.connect();
  return { api, sent, emit };
}

const payload = {
  backgroundUrl: "old.pdf",
  overlayUrl: "new.pdf"
};

const result = {
  relativePath: "compare-result.pdf",
  outputFileUrl: "https://files.example.com/compare-result.pdf",
  activeFile: { name: "new.pdf" },
  otherFile: { name: "old.pdf" },
  mode: "compare"
};

test("compare resolves after the result and progress completion events", async () => {
  const { api, sent, emit } = brokerHarness();
  const pending = api.compare(payload);
  let settled = false;
  pending.then(() => {
    settled = true;
  });

  assert.equal(sent[0].type, "compare");
  emit("comparisonComplete", result);
  await Promise.resolve();
  assert.equal(settled, false);

  emit("progressEnd");
  assert.deepEqual(await pending, result);
});

test("compare rejects on Canvas comparisonError", async () => {
  const { api, emit } = brokerHarness();
  const pending = api.compare(payload);

  emit("comparisonError", { mode: "compare", message: "Compare failed." });

  await assert.rejects(pending, (error) => {
    assert.equal(error.code, "UNKNOWN_COMMAND");
    assert.equal(error.message, "Compare failed.");
    return true;
  });
});

test("compare rejects with a command timeout when Canvas does not complete", async () => {
  const { api } = brokerHarness(10);

  await assert.rejects(api.compare(payload), (error) => {
    assert.equal(error.code, "COMMAND_TIMEOUT");
    assert.equal(error.context.type, "compare");
    assert.equal(error.context.timeoutMs, 10);
    return true;
  });
});

test("compare rejects when the viewer disconnects", async () => {
  const { api } = brokerHarness();
  const pending = api.compare(payload);

  api.disconnect();

  await assert.rejects(pending, { code: "VIEWER_NOT_READY" });
});

test("interactive align retains its empty completion event behavior", () => {
  const { api, emit } = brokerHarness();
  const events = [];
  api.on("comparisonComplete", (value) => events.push(value));

  api.align(payload);
  emit("comparisonComplete");
  emit("comparisonComplete", { ...result, mode: "align" });

  assert.equal(events.length, 2);
  assert.equal(events[0], undefined);
  assert.equal(events[1].mode, "align");
});
