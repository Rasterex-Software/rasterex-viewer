import assert from "node:assert/strict";
import { test } from "node:test";
import { ClientCompareApi } from "../dist/domains/client-compare/ClientCompareApi.js";

function brokerHarness() {
  const handlers = new Map();
  const sent = [];
  const broker = {
    on(type, handler) {
      const listeners = handlers.get(type) ?? new Set();
      listeners.add(handler);
      handlers.set(type, listeners);
      return () => listeners.delete(handler);
    },
    send(type, payload) { sent.push({ type, payload }); }
  };
  const emit = (type, payload) => {
    for (const handler of handlers.get(type) ?? []) handler({ type, payload });
  };
  const api = new ClientCompareApi({
    getBroker: () => broker,
    getIsReady: () => true,
    commandTimeoutMs: 100
  });
  api.connect();
  return { api, sent, emit };
}

test("creates a client comparison and exposes the ready event", async () => {
  const { api, sent, emit } = brokerHarness();
  const events = [];
  api.on("ready", (result) => events.push(result));
  const pending = api.create({ backgroundUrl: "old.pdf", overlayUrl: "new.pdf", timeoutMs: 90 });
  assert.equal(sent[0].type, "clientCompare");
  assert.equal("timeoutMs" in sent[0].payload, false);
  const result = {
    success: true, requestId: sent[0].payload.requestId,
    backgroundFileIndex: 0, overlayFileIndex: 1, comparisonFileIndex: 1
  };
  emit("clientCompareReady", result);
  assert.deepEqual(await pending, result);
  assert.deepEqual(events, [result]);
});

test("validates sources, opacity, and common level", () => {
  const { api } = brokerHarness();
  assert.throws(() => api.create({ backgroundUrl: "same.pdf", overlayUrl: "same.pdf" }));
  assert.rejects(api.setOpacity(101));
  assert.rejects(api.setCommonLevel(11));
});

test("correlates opacity and common-level responses", async () => {
  const { api, sent, emit } = brokerHarness();
  const create = api.create({ backgroundUrl: "old.pdf", overlayUrl: "new.pdf" });
  emit("clientCompareReady", { success: true, requestId: sent[0].payload.requestId });
  await create;
  const opacity = api.setOpacity(50);
  const level = api.setCommonLevel(5);
  emit("clientCompareOpacityChanged", { success: true, requestId: sent[1].payload.requestId, value: 50 });
  emit("clientCompareCommonLevelChanged", { success: true, requestId: sent[2].payload.requestId, level: 5 });
  await Promise.all([opacity, level]);
});

test("keeps alignment active after start acknowledgement until completion", async () => {
  const { api, sent, emit } = brokerHarness();
  const create = api.create({ backgroundUrl: "old.pdf", overlayUrl: "new.pdf" });
  emit("clientCompareReady", { success: true, requestId: sent[0].payload.requestId });
  await create;
  const started = api.startAlign();
  emit("clientCompareAlignStarted", { success: true, requestId: sent[1].payload.requestId });
  await started;
  await assert.rejects(api.setOpacity(50));
  const complete = { success: true, requestId: sent[1].payload.requestId, comparisonFileIndex: 2 };
  emit("clientCompareAlignComplete", complete);
  const closed = api.close();
  emit("clientCompareClosed", { success: true, requestId: sent[2].payload.requestId });
  await closed;
});

test("Canvas failure rejects the matching operation", async () => {
  const { api, sent, emit } = brokerHarness();
  const pending = api.create({ backgroundUrl: "old.pdf", overlayUrl: "new.pdf" });
  emit("clientCompareFailed", {
    success: false, requestId: sent[0].payload.requestId, error: "source_files_must_differ"
  });
  await assert.rejects(pending, { code: "UNKNOWN_COMMAND" });
});

test("disconnect cancels pending client compare operations", async () => {
  const { api } = brokerHarness();
  const pending = api.create({ backgroundUrl: "old.pdf", overlayUrl: "new.pdf" });
  api.disconnect();
  await assert.rejects(pending, { code: "VIEWER_NOT_READY" });
});
