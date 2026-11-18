import assert from "node:assert/strict";
import test from "node:test";
import { AnnotationsApi } from "../dist/index.js";

const record = {
  Entity: {
    Type: 8,
    Subtype: 0,
    UniqueID: "SAVED-AREA",
    ScalingObject: { measurescale: 200 }
  }
};
const options = { format: "json", data: { items: [record] } };

function createViewer() {
  const listeners = new Map();
  const sent = [];
  const emit = (type, payload) => {
    for (const handler of listeners.get(type) ?? []) {
      handler({ type, payload });
    }
  };
  const broker = {
    on(type, handler) {
      const handlers = listeners.get(type) ?? new Set();
      listeners.set(type, handlers);
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    send(type, payload) {
      sent.push({ type, payload });
    }
  };
  const annotations = new AnnotationsApi({
    getBroker: () => broker,
    getIsReady: () => true,
    commandTimeoutMs: 250
  });

  function complete(overrides = {}) {
    const { requestId, format, merge, replacePolicy, measurementScalePolicy } =
      sent.at(-1).payload;
    const result = {
      requestId,
      format,
      merge,
      replacePolicy,
      measurementScalePolicy,
      loaded: 1,
      skipped: 0,
      total: 1,
      ...overrides
    };
    emit("annotationsLoaded", result);
    return result;
  }

  return { annotations, sent, broker, listeners, emit, complete };
}

test("merges by default and preserves Canvas counts without counting them as creations", async () => {
  const viewer = createViewer();
  const pending = viewer.annotations.load(options);
  const [{ type, payload }] = viewer.sent;
  assert.equal(type, "loadAnnotations");
  assert.deepEqual(JSON.parse(payload.data), options.data);
  assert.equal(payload.source, "inline");
  assert.equal(payload.merge, true);
  assert.equal(payload.replacePolicy, "skip");
  assert.equal(payload.measurementScalePolicy, "currentPage");
  assert.equal(payload.emitCreated, true);
  viewer.emit("annotationsLoaded", { requestId: "different" });
  viewer.emit("annotationsLoaded", { loaded: 2 });
  const result = viewer.complete({ skipped: 1 });
  assert.deepEqual(await pending, result);
  assert.equal(viewer.listeners.get("annotationsLoaded").size, 0);
});

test("maps JSON replacement, scale and event choices explicitly", async () => {
  const viewer = createViewer();
  const replace = viewer.annotations.load({ ...options, replacePolicy: "replace" });
  assert.equal(viewer.sent.at(-1).payload.replacePolicy, "replace");
  viewer.complete();
  await replace;

  const overwrite = viewer.annotations.load({
    ...options,
    mode: "replaceAll",
    measurementScalePolicy: "preserve",
    emitCreated: false
  });
  const { payload } = viewer.sent.at(-1);
  assert.equal(payload.merge, false);
  assert.equal(payload.measurementScalePolicy, "preserve");
  assert.equal(payload.emitCreated, false);
  assert.equal(JSON.parse(payload.data).items[0].Entity.ScalingObject.measurescale, 200);
  viewer.complete();
  await overwrite;
});

test("rejects invalid data before a replace-all command can clear records", async () => {
  const viewer = createViewer();
  for (const data of ["{", "null", [], { items: [] }, {}, [record, 1], { Entity: {} }]) {
    await assert.rejects(
      viewer.annotations.load({ ...options, mode: "replaceAll", data })
    );
  }
  await assert.rejects(
    viewer.annotations.load({
      format: "xml",
      source: "url",
      mode: "replaceAll",
      data: "https://example.com/sample.rxml"
    }),
    /inline content/
  );
  assert.equal(viewer.sent.length, 0);
});

test("sends explicit XML URL imports through Canvas without an SDK fetch", async () => {
  const viewer = createViewer();
  const data = "https://example.com/sample.rxml";
  const pending = viewer.annotations.load({ format: "xml", source: "url", data });
  assert.equal(viewer.sent.at(-1).payload.data, data);
  assert.equal(viewer.sent.at(-1).payload.source, "url");
  assert.equal(viewer.sent.at(-1).payload.merge, true);
  viewer.complete();
  await pending;
});

test("surfaces native reasons and rejects malformed or unconfirmed preserve receipts", async () => {
  const viewer = createViewer();
  const failing = viewer.annotations.load(options);
  viewer.complete({ reason: "missingPayload" });
  await assert.rejects(failing, /missingPayload/);
  const malformed = viewer.annotations.load(options);
  viewer.complete({ total: -1 });
  await assert.rejects(malformed, /invalid annotation import result/);
  const preserve = viewer.annotations.load({
    ...options,
    measurementScalePolicy: "preserve"
  });
  viewer.complete({ measurementScalePolicy: undefined });
  await assert.rejects(preserve, /did not confirm/);
});

test("rejects overlap and times out without sending another import into an uncertain viewer", async () => {
  const viewer = createViewer();
  const pending = viewer.annotations.load({ ...options, timeoutMs: 10 });
  await assert.rejects(viewer.annotations.load(options), /already in progress/);
  await assert.rejects(pending, { code: "COMMAND_TIMEOUT" });
  assert.equal(viewer.listeners.get("annotationsLoaded").size, 0);
  await assert.rejects(viewer.annotations.load(options), /Reconnect/);
  assert.equal(viewer.sent.length, 1);
});

test("cleans up both on disconnect and when sending throws", async () => {
  const viewer = createViewer();
  const pending = viewer.annotations.load(options);
  viewer.annotations.disconnect();
  await assert.rejects(pending, { code: "VIEWER_NOT_READY" });
  assert.equal(viewer.listeners.get("annotationsLoaded").size, 0);
  viewer.broker.send = () => {
    throw new Error("transport failed");
  };
  await assert.rejects(viewer.annotations.load(options), /Could not send/);
  assert.equal(viewer.listeners.get("annotationsLoaded").size, 0);
});
