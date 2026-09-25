import assert from "node:assert/strict";
import { test } from "node:test";
import { ViewSyncApi } from "../dist/domains/view-sync/ViewSyncApi.js";

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
  const api = new ViewSyncApi({ getBroker: () => broker, getIsReady: () => true, commandTimeoutMs: 100 });
  return { api, sent, emit };
}

test("configure correlates its acknowledgement and binds changed events to this iframe", async () => {
  const { api, sent, emit } = brokerHarness();
  const changes = [];
  api.on("changed", (change) => changes.push(change));
  const pending = api.configure({ groupId: "review", instanceId: "left", mode: "panAndZoom" });
  const request = sent[0];
  assert.equal(request.type, "configureViewSync");
  assert.equal(request.payload.enabled, true);
  assert.equal(typeof request.payload.requestId, "string");
  emit("viewSyncConfigured", { success: true, requestId: "another-request" });
  emit("viewSyncConfigured", { success: true, requestId: request.payload.requestId });
  await pending;

  const change = { groupId: "review", sourceInstanceId: "left", sequence: 1,
    state: { pan: { sx: 10, sy: 20 } } };
  emit("viewSyncChanged", { ...change, sourceInstanceId: "right" });
  emit("viewSyncChanged", { ...change, state: { pan: { sx: Infinity, sy: 20 } } });
  emit("viewSyncChanged", change);
  assert.deepEqual(changes, [change]);
});

test("apply sends the documented state and selected axes", () => {
  const { api, sent } = brokerHarness();
  const change = { groupId: "review", sourceInstanceId: "left", sequence: 2,
    state: { pan: { sx: 10, sy: 20 }, zoom: { zoomparams: {}, type: 1 } } };
  api.apply(change, { pan: false });
  assert.deepEqual(sent[0], { type: "applyViewSync", payload: {
    ...change, apply: { pan: false, zoom: true }
  } });
  assert.throws(() => api.apply(change, { pan: false, zoom: false }));
});

test("disconnect rejects a pending configuration", async () => {
  const { api } = brokerHarness();
  const pending = api.configure({ groupId: "review", instanceId: "left", mode: "pan" });
  api.disconnect();
  await assert.rejects(pending, { code: "VIEWER_NOT_READY" });
});

test("Canvas configuration failure rejects and a later configuration can proceed", async () => {
  const { api, sent, emit } = brokerHarness();
  const first = api.configure({ groupId: "review", instanceId: "left", mode: "pan" });
  emit("viewSyncConfigured", {
    success: false, reason: "unsupported_mode", requestId: sent[0].payload.requestId
  });
  await assert.rejects(first, { code: "UNKNOWN_COMMAND" });
  const second = api.configure({ groupId: "review", instanceId: "left", mode: "zoom" });
  emit("viewSyncConfigured", { success: true, requestId: sent[1].payload.requestId });
  await second;
});

test("apply outcome events are exposed without assuming request IDs", () => {
  const { api, emit } = brokerHarness();
  const outcomes = [];
  api.on("applied", (event) => outcomes.push(event));
  api.on("failed", (event) => outcomes.push(event));
  const applied = { success: true, groupId: "review", sourceInstanceId: "left", sequence: 3 };
  const failed = { success: false, reason: "apply_failed" };
  emit("viewSyncApplied", applied);
  emit("viewSyncFailed", failed);
  assert.deepEqual(outcomes, [applied, failed]);
});
