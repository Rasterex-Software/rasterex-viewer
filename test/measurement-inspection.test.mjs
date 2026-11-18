import test from "node:test";
import assert from "node:assert/strict";
import { MeasurementsApi, RasterexViewer } from "../dist/index.js";

const identity = { fileIndex: 0, pageIndex: 0, guid: "ABC" };

function harness(overrides = {}) {
  const listeners = new Map(),
    sent = [];
  const broker = {
    on(type, fn) {
      let set = listeners.get(type);

      if (!set) {
        listeners.set(type, (set = new Set()));
      }
      set.add(fn);

      return () => set.delete(fn);
    },

    send(type, payload) {
      sent.push({ type, payload });
    }
  };
  const api = new MeasurementsApi({
    getBroker: () => broker,
    getIsReady: () => true,
    getCapabilities: () => ["measurementInfo", "nativeVertexSelection"],
    commandTimeoutMs: 500,
    ...overrides
  });

  return {
    api,
    sent,
    broker,

    emit(type, payload) {
      for (const fn of [...(listeners.get(type) || [])]) {
        fn({ payload });
      }
    },

    count() {
      return [...listeners.values()].reduce((n, s) => n + s.size, 0);
    }
  };
}

const info = (requestId, extra = {}) => ({
  success: true,
  requestId,
  fileIndex: 0,
  pageIndex: 0,
  measurement: {
    guid: "ABC",
    pageIndex: 0,
    kind: "Distance",
    value: "10 mm",
    vertexCount: 2,
    holeCount: 0,
    readOnly: false
  },
  geometry: { available: false, reason: "Scale unavailable", precision: 2 },
  ...extra
});

const selected = (requestId) => ({
  success: true,
  requestId,
  ...identity,
  vertexIndex: 1,
  active: true,
  selection: {
    guid: "ABC",
    pageIndex: 0,
    vertexIndex: 1,
    point: { x: 12, y: 14 },
    coordinateSpace: "nativeAnnotation",
    measurement: "Distance"
  }
});
test("inspection is explicit, normalizes GUID, copies input and allows unavailable calculations", async () => {
  const h = harness();
  assert.equal(h.sent.length, 0);
  const options = { ...identity, guid: " {abc} ", requestId: "read" };
  const pending = h.api.getInfo(options);
  options.pageIndex = 4;
  assert.deepEqual(h.sent[0], {
    type: "getMeasurementInfo",
    payload: { ...identity, requestId: "read" }
  });
  h.emit("measurementInfo", info("read"));
  assert.equal((await pending).geometry.available, false);
  assert.equal(h.count(), 0);
});
test("three APIs correlate independently; uncorrelated and wrong event replies are ignored", async () => {
  const h = harness();
  const read = h.api.getInfo({ ...identity, vertexIndex: 1, requestId: "r" }),
    select = h.api.selectVertex({ ...identity, vertexIndex: 1, requestId: "s" }),
    clear = h.api.clearVertexSelection({ requestId: "c" });
  h.emit("measurementInfo", info(undefined));
  h.emit("measurementInfo", info("other"));
  h.emit("measurementVertexSelected", selected("r"));
  assert.equal(h.count(), 3);
  h.emit("measurementVertexSelectionCleared", {
    success: true,
    active: false,
    requestId: "c"
  });
  await clear;
  h.emit("measurementVertexSelected", selected("s"));
  assert.equal((await select).selection.coordinateSpace, "nativeAnnotation");
  h.emit(
    "measurementInfo",
    info("r", {
      vertex: { index: 1, point: { x: 1, y: 2 }, coordinateSpace: "nativeAnnotation" }
    })
  );
  await read;
  assert.equal(h.count(), 0);
  assert.deepEqual(
    h.sent.map((x) => x.type),
    ["getMeasurementInfo", "selectMeasurementVertex", "clearMeasurementVertexSelection"]
  );
});
test("validates request inputs before send and rejects duplicate pending IDs", async () => {
  const h = harness();
  for (const options of [
    null,
    undefined,
    [],
    {},
    { ...identity, fileIndex: -1 },
    { ...identity, pageIndex: 0.2 },
    { ...identity, guid: "{}" },
    { ...identity, guid: "x".repeat(129) },
    { ...identity, vertexIndex: 1000 },
    { ...identity, vertexIndex: -1 },
    { ...identity, requestId: "" },
    { ...identity, requestId: "x".repeat(257) },
    ...[0, -1, Infinity, NaN, "1", 2147483648].map((timeoutMs) => ({
      ...identity,
      timeoutMs
    }))
  ]) {
    await assert.rejects(h.api.getInfo(options), { code: "UNKNOWN_COMMAND" });
  }
  await assert.rejects(h.api.selectVertex(identity), { code: "UNKNOWN_COMMAND" });
  assert.equal(h.sent.length, 0);
  const pending = h.api.getInfo({ ...identity, requestId: "same" });
  await assert.rejects(h.api.clearVertexSelection({ requestId: "same" }), {
    code: "UNKNOWN_COMMAND"
  });
  h.emit("measurementInfo", info("same"));
  await pending;
});
test("capability and readiness checks leave existing scale API available", async () => {
  for (const getCapabilities of [undefined, () => [], () => null]) {
    const h = harness({ getCapabilities });
    await assert.rejects(h.api.getInfo(identity), { code: "CAPABILITY_NOT_SUPPORTED" });
    await assert.rejects(h.api.selectVertex({ ...identity, vertexIndex: 0 }), {
      code: "CAPABILITY_NOT_SUPPORTED"
    });
    await assert.rejects(h.api.clearVertexSelection(), {
      code: "CAPABILITY_NOT_SUPPORTED"
    });
    assert.equal(h.sent.length, 0);
    h.api.scale.request();
    assert.equal(h.sent[0].type, "getScales");
  }
  for (const options of [{ getIsReady: () => false }, { getBroker: () => null }]) {
    await assert.rejects(harness(options).api.getInfo(identity), {
      code: "VIEWER_NOT_READY"
    });
  }
});
test("preserves native failure details, including read-only and active-gesture failures", async () => {
  for (const error of [
    "vertex_selection_read_only",
    "native_interaction_active",
    "unsupported_measurement",
    "invalid_vertex_index"
  ]) {
    const h = harness();
    const p = h.api.selectVertex({ ...identity, vertexIndex: 1, requestId: "fail" });
    const result = { success: false, requestId: "fail", error };
    h.emit("measurementVertexSelected", result);
    await assert.rejects(p, (e) => e.message === error && e.context.result === result);
    assert.equal(h.count(), 0);
  }
});
test("rejects contradictory or malformed inspection and selection results", async () => {
  const bad = [
    { success: "true" },
    { fileIndex: 2 },
    { measurement: { ...info("x").measurement, guid: "OTHER" } },
    { geometry: { available: true, precision: 2 } },
    {
      vertex: {
        index: 0,
        point: { x: Infinity, y: 0 },
        coordinateSpace: "nativeAnnotation"
      }
    }
  ];
  for (const change of bad) {
    const h = harness();
    const p = h.api.getInfo({ ...identity, requestId: "x" });
    h.emit("measurementInfo", info("x", change));
    await assert.rejects(p, { code: "UNKNOWN_COMMAND" });
    assert.equal(h.count(), 0);
  }
  const h = harness();
  const p = h.api.selectVertex({ ...identity, vertexIndex: 1, requestId: "x" });
  const result = selected("x");
  result.selection.coordinateSpace = "pdf";
  h.emit("measurementVertexSelected", result);
  await assert.rejects(p, { code: "UNKNOWN_COMMAND" });
  const c = h.api.clearVertexSelection({ requestId: "c" });
  h.emit("measurementVertexSelectionCleared", {
    success: true,
    active: true,
    requestId: "c"
  });
  await assert.rejects(c, { code: "UNKNOWN_COMMAND" });
});
test("timeout, send failure and disconnect release listeners and pending IDs without extra commands", async () => {
  const h = harness();
  await assert.rejects(
    h.api.getInfo({ ...identity, requestId: "timeout", timeoutMs: 5 }),
    { code: "COMMAND_TIMEOUT" }
  );
  assert.equal(h.count(), 0);
  h.broker.send = () => {
    throw Error("send failed");
  };
  await assert.rejects(h.api.clearVertexSelection({ requestId: "send" }), {
    code: "UNKNOWN_COMMAND"
  });
  assert.equal(h.count(), 0);
  h.broker.send = () => {};
  const promises = [
    h.api.getInfo({ ...identity, requestId: "r" }),
    h.api.selectVertex({ ...identity, vertexIndex: 1, requestId: "s" }),
    h.api.clearVertexSelection({ requestId: "c" })
  ];
  const rejected = promises.map((p) => assert.rejects(p, { code: "VIEWER_NOT_READY" }));
  h.api.disconnect();
  await Promise.all(rejected);
  assert.equal(h.count(), 0);
});
test("all native measurement kinds retain metadata; vertex request requires matching native coordinates", async () => {
  for (const kind of [
    "Distance",
    "Area",
    "Path",
    "Rectangular area",
    "Arc",
    "Angle",
    "Count"
  ]) {
    const h = harness();
    const p = h.api.getInfo({ ...identity, requestId: kind });
    h.emit(
      "measurementInfo",
      info(kind, { measurement: { ...info(kind).measurement, kind, readOnly: true } })
    );
    assert.equal((await p).measurement.kind, kind);
  }
  const h = harness();
  const p = h.api.getInfo({ ...identity, vertexIndex: 0, requestId: "v" });
  h.emit("measurementInfo", info("v"));
  await assert.rejects(p, { code: "UNKNOWN_COMMAND" });
});
import { ViewerMessagingSession } from "../dist/messaging/ViewerMessagingSession.js";

function sessionHarness() {
  const listeners = new Set();
  const sent = [];
  const iframe = {
    isConnected: true,
    contentWindow: {
      postMessage: (...args) => sent.push(args)
    },

    remove() {}
  };
  const windowRef = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener)
  };
  const previous = globalThis.window;
  globalThis.window = windowRef;
  const session = new ViewerMessagingSession({
    iframe,
    targetOrigin: "https://viewer.example.com",
    sdkInstanceId: "sdk-test",
    diagnostics: { emit() {} }
  });
  session.start();
  const emit = (type, payload, overrides = {}) => {
    const event = {
      data: { type, payload },
      origin: "https://viewer.example.com",
      source: iframe.contentWindow,
      ...overrides
    };
    for (const listener of [...listeners]) {
      listener(event);
    }
  };

  return {
    session,
    iframe,
    sent,
    emit,
    restore: () => {
      session.destroy();
      globalThis.window = previous;
    }
  };
}
test("viewer wires capabilities, validates parent origin/source and cancels inspection on destroy", async () => {
  const h = sessionHarness();

  try {
    const viewer = new RasterexViewer({
      container: "#viewer",
      viewerUrl: "https://viewer.example.com"
    });
    viewer.iframe = h.iframe;
    viewer.messagingSession = h.session;
    h.emit("viewerReady", { capabilities: ["measurementInfo", "nativeVertexSelection"] });
    await viewer.ready();
    const pending = viewer.measurements.getInfo({ ...identity, requestId: "secure" });
    assert.equal(h.sent.at(-1)[1], "https://viewer.example.com");
    h.emit("measurementInfo", info("secure"), { origin: "https://wrong.example.com" });
    h.emit("measurementInfo", info("secure"), { source: {} });
    let resolved = false;
    pending.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    assert.equal(resolved, false);
    h.emit("measurementInfo", info("secure"));
    await pending;
    const selecting = viewer.measurements.selectVertex({
      ...identity,
      vertexIndex: 1,
      requestId: "destroy"
    });
    const rejected = assert.rejects(selecting, { code: "VIEWER_NOT_READY" });
    viewer.destroy();
    await rejected;
  } finally {
    h.restore();
  }
});
test("selection and clear timeouts never retry or clear newer native state automatically", async () => {
  const h = harness();
  for (const action of ["select", "clear"]) {
    const pending =
      action === "select"
        ? h.api.selectVertex({ ...identity, vertexIndex: 1, timeoutMs: 5 })
        : h.api.clearVertexSelection({ timeoutMs: 5 });
    await assert.rejects(pending, { code: "COMMAND_TIMEOUT" });
    assert.equal(h.count(), 0);
  }
  assert.deepEqual(
    h.sent.map((x) => x.type),
    ["selectMeasurementVertex", "clearMeasurementVertexSelection"]
  );
});
