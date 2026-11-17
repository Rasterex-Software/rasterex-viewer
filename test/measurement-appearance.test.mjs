import assert from "node:assert/strict";
import test from "node:test";
import { RasterexViewer, StylesApi } from "../dist/index.js";
import { ViewerMessagingSession } from "../dist/messaging/ViewerMessagingSession.js";

function harness(options = {}) {
  const handlers = new Set();
  const sent = [];
  const broker = {
    on(type, handler) {
      assert.equal(type, "measurementAppearanceChanged");
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    send(type, payload) { sent.push({ type, payload }); }
  };
  const api = new StylesApi({
    getBroker: () => broker,
    getIsReady: () => true,
    getCapabilities: () => ["measurementAppearance"],
    commandTimeoutMs: 1000,
    ...options
  });
  return {
    api, sent, broker, handlers,
    emit: payload => { for (const handler of [...handlers]) handler({ payload }); }
  };
}

test("appearance remains opt-in and both modes use correlated Canvas commands", async () => {
  const { api, sent, emit, handlers } = harness();
  assert.deepEqual(sent, []);
  for (const mode of ["modern", "legacy", "modern"]) {
    const options = { mode, timeoutMs: 800 };
    const pending = api.setMeasurementAppearance(options);
    const command = sent.at(-1);
    assert.equal(command.type, "setMeasurementAppearance");
    assert.equal(command.payload.mode, mode);
    assert.equal(typeof command.payload.requestId, "string");
    assert.equal("timeoutMs" in command.payload, false);
    // The caller cannot change the expected mode after the command was sent.
    options.mode = mode === "modern" ? "legacy" : "modern";
    const result = { success: true, ...command.payload };
    emit(result);
    assert.deepEqual(await pending, result);
    assert.equal(handlers.size, 0);
  }
  assert.equal(new Set(sent.map(command => command.payload.requestId)).size, 3);
});

test("overlapping switches ignore unrelated and uncorrelated responses", async () => {
  const { api, emit, handlers } = harness();
  const modern = api.setMeasurementAppearance({ mode: "modern", requestId: "modern-1" });
  const legacy = api.setMeasurementAppearance({ mode: "legacy", requestId: "legacy-2" });
  emit({ success: true, mode: "modern" });
  emit({ success: true, mode: "modern", requestId: "stale" });
  assert.equal(handlers.size, 2);
  emit({ success: true, mode: "legacy", requestId: "legacy-2" });
  assert.equal((await legacy).mode, "legacy");
  assert.equal(handlers.size, 1);
  emit({ success: true, mode: "modern", requestId: "modern-1" });
  assert.equal((await modern).mode, "modern");
  assert.equal(handlers.size, 0);
});

test("appearance validates input, readiness, capability and duplicate pending IDs", async () => {
  const { api, sent, emit } = harness();
  for (const options of [undefined, null, {}, { mode: "other" },
    { mode: "modern", requestId: " " }, { mode: "modern", requestId: 5 },
    { mode: "modern", requestId: "x".repeat(257) },
    ...[0, -1, NaN, Infinity, 0.5, 2 ** 31].map(timeoutMs => ({ mode: "modern", timeoutMs }))]) {
    await assert.rejects(api.setMeasurementAppearance(options), { code: "UNKNOWN_COMMAND" });
  }
  assert.equal(sent.length, 0);
  await assert.rejects(harness({ getIsReady: () => false }).api.setMeasurementAppearance({ mode: "modern" }),
    { code: "VIEWER_NOT_READY" });
  await assert.rejects(harness({ getBroker: () => null }).api.setMeasurementAppearance({ mode: "modern" }),
    { code: "VIEWER_NOT_READY" });
  for (const getCapabilities of [undefined, () => null, () => [], () => ["viewSync"]]) {
    const unsupported = harness({ getCapabilities });
    await assert.rejects(unsupported.api.setMeasurementAppearance({ mode: "modern" }),
      { code: "CAPABILITY_NOT_SUPPORTED" });
    assert.equal(unsupported.sent.length, 0);
  }
  const first = api.setMeasurementAppearance({ mode: "modern", requestId: "same" });
  await assert.rejects(api.setMeasurementAppearance({ mode: "legacy", requestId: "same" }),
    { code: "UNKNOWN_COMMAND" });
  emit({ success: true, mode: "modern", requestId: "same" });
  await first;
});

test("explicit Canvas failure preserves its error and cleans up", async () => {
  const { api, emit, handlers } = harness();
  const pending = api.setMeasurementAppearance({ mode: "modern", requestId: "fail" });
  const result = { success: false, mode: "legacy", requestId: "fail", error: "measurement_appearance_unavailable" };
  emit(result);
  await assert.rejects(pending, error => {
    assert.equal(error.code, "UNKNOWN_COMMAND");
    assert.equal(error.message, result.error);
    assert.deepEqual(error.context.result, result);
    return true;
  });
  assert.equal(handlers.size, 0);
  const retry = api.setMeasurementAppearance({ mode: "modern", requestId: "fail" });
  emit({ success: true, mode: "modern", requestId: "fail" });
  await retry;
});

test("matching malformed or contradictory success results fail explicitly", async () => {
  for (const result of [{ mode: "modern" }, { success: "true", mode: "modern" },
    { success: true }, { success: true, mode: "legacy" }, { success: true, mode: "modern", error: 42 }]) {
    const { api, emit, handlers } = harness();
    const pending = api.setMeasurementAppearance({ mode: "modern", requestId: "invalid" });
    emit({ ...result, requestId: "invalid" });
    await assert.rejects(pending, { code: "UNKNOWN_COMMAND" });
    assert.equal(handlers.size, 0);
  }
});

test("timeouts, disconnects and transport failures release pending requests", async () => {
  const { api, handlers, emit, broker } = harness();
  const timedOut = api.setMeasurementAppearance({ mode: "modern", requestId: "timeout", timeoutMs: 10 });
  await assert.rejects(timedOut, error => {
    assert.equal(error.code, "COMMAND_TIMEOUT");
    assert.equal(error.context.id, "timeout");
    return true;
  });
  assert.equal(handlers.size, 0);
  const one = api.setMeasurementAppearance({ mode: "modern", requestId: "one" });
  const two = api.setMeasurementAppearance({ mode: "legacy", requestId: "two" });
  api.disconnect();
  await Promise.all([one, two].map(pending => assert.rejects(pending, { code: "VIEWER_NOT_READY" })));
  assert.equal(handlers.size, 0);
  emit({ success: true, mode: "modern", requestId: "one" });
  broker.send = () => { throw new Error("clone failed"); };
  await assert.rejects(api.setMeasurementAppearance({ mode: "modern" }), error => {
    assert.equal(error.context.cause, "clone failed");
    return true;
  });
  assert.equal(handlers.size, 0);
});

function sessionHarness() {
  const listeners = new Set();
  const sent = [];
  const iframe = { isConnected: true, contentWindow: {
    postMessage: (...args) => sent.push(args)
  }, remove() {} };
  const windowRef = {
    setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener)
  };
  const previous = globalThis.window;
  globalThis.window = windowRef;
  const session = new ViewerMessagingSession({
    iframe, targetOrigin: "https://viewer.example.com", sdkInstanceId: "sdk-test",
    diagnostics: { emit() {} }
  });
  session.start();
  const emit = (type, payload, overrides = {}) => {
    const event = { data: { type, payload }, origin: "https://viewer.example.com", source: iframe.contentWindow, ...overrides };
    for (const listener of [...listeners]) listener(event);
  };
  return { session, iframe, sent, emit, restore: () => { session.destroy(); globalThis.window = previous; } };
}

test("viewer retains early and live Canvas capabilities without activating Modern", async () => {
  for (const early of [true, false]) {
    const h = sessionHarness();
    try {
      const viewer = new RasterexViewer({ container: "#viewer", viewerUrl: "https://viewer.example.com" });
      viewer.iframe = h.iframe;
      viewer.messagingSession = h.session;
      const payload = { instanceId: "canvas-a", capabilities: ["measurementAppearance", "viewSync", "futureCapability"] };
      if (early) h.emit("viewerReady", payload);
      const ready = viewer.ready();
      if (!early) h.emit("viewerReady", payload);
      await ready;
      payload.capabilities.push("injected");
      assert.deepEqual(viewer.getInfo().capabilities, ["iframe", "document.open", "measurementAppearance", "viewSync", "futureCapability"]);
      assert.equal(viewer.getInfo().compatibility.state, "degraded");
      assert.equal(Object.isFrozen(viewer.getInfo().capabilities), true);
      assert.equal(h.sent.length, 0, "SDK must not automatically activate Modern or Legacy");
      const pending = viewer.styles.setMeasurementAppearance({ mode: "modern" });
      let settled = false;
      pending.then(() => { settled = true; }, () => { settled = true; });
      const [command, targetOrigin] = h.sent[0];
      assert.equal(targetOrigin, "https://viewer.example.com");
      h.emit("measurementAppearanceChanged", { success: true, ...command.payload }, { origin: "https://wrong.example.com" });
      h.emit("measurementAppearanceChanged", { success: true, ...command.payload }, { source: {} });
      await Promise.resolve();
      assert.equal(settled, false, "unauthorized replies must not settle the command");
      const result = { success: true, ...command.payload };
      h.emit("measurementAppearanceChanged", result);
      assert.deepEqual(await pending, result);
      const unfinished = viewer.styles.setMeasurementAppearance({ mode: "legacy" });
      viewer.destroy();
      await assert.rejects(unfinished, { code: "VIEWER_NOT_READY" });
      assert.equal(h.session.canvasCapabilities, null);
    } finally { h.restore(); }
  }
});

test("legacy viewers and malformed or unauthorized capability lists cannot opt in", async () => {
  for (const payload of [undefined, {}, { capabilities: [] }, { capabilities: ["measurementAppearance", 1] }]) {
    const h = sessionHarness();
    try {
      h.emit("viewerReady", { capabilities: ["measurementAppearance"] }, { origin: "https://wrong.example.com" });
      h.emit("viewerReady", { capabilities: ["measurementAppearance"] }, { source: {} });
      assert.equal(h.session.canvasCapabilities, null);
      h.emit("viewerReady", payload);
      const viewer = new RasterexViewer({ container: "#viewer", viewerUrl: "https://viewer.example.com" });
      viewer.iframe = h.iframe;
      viewer.messagingSession = h.session;
      await viewer.ready();
      assert.deepEqual(viewer.getInfo().capabilities, ["iframe", "document.open"]);
      await assert.rejects(viewer.styles.setMeasurementAppearance({ mode: "modern" }), { code: "CAPABILITY_NOT_SUPPORTED" });
      assert.equal(h.sent.length, 0);
      viewer.destroy();
    } finally { h.restore(); }
  }
});
