import assert from "node:assert/strict";
import test from "node:test";
import { AnnotationsApi, ToolsApi } from "../dist/index.js";

const toolState = { tools: { COUNT: false, SNAP: true }, navigation: { PAN: false } };

function harness(capabilities = ["parentTools", "countWorkflow", "countItemInfo"]) {
  const listeners = new Map();
  const sent = [];
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
  const options = {
    getBroker: () => broker,
    getIsReady: () => true,
    getCapabilities: () => capabilities,
    commandTimeoutMs: 500
  };
  function emit(type, payload) {
    for (const handler of [...(listeners.get(type) ?? [])]) {
      handler({ type, payload });
    }
  }
  function reply(type, extra = {}) {
    emit(type, {
      success: true,
      ...toolState,
      requestId: sent.at(-1).payload.requestId,
      ...extra
    });
  }
  return {
    annotations: new AnnotationsApi(options),
    tools: new ToolsApi(options),
    sent,
    emit,
    reply,
    listeners,
    broker
  };
}

test("editing correlates replies by ID and action and preserves Canvas rejection reasons", async () => {
  const h = harness();
  const state = h.tools.getState();
  h.reply("parentToolState");
  assert.equal((await state).tools.SNAP, true);

  const undo = h.annotations.undo({ requestId: "undo-test" });
  assert.deepEqual(h.sent.at(-1), {
    type: "editAnnotations",
    payload: { action: "undo", requestId: "undo-test" }
  });
  h.emit("annotationEditResult", {
    success: true,
    ...toolState,
    action: "undo",
    requestId: "other"
  });
  assert.equal(h.listeners.get("annotationEditResult").size, 1);
  h.reply("annotationEditResult", { action: "redo" });
  await assert.rejects(undo, /invalid result/);

  const deletion = h.annotations.deleteSelected();
  h.reply("annotationEditResult", { success: false, error: "native_interaction_active" });
  await assert.rejects(
    deletion,
    (error) =>
      error.message === "native_interaction_active" &&
      error.context.result.error === "native_interaction_active"
  );
});

test("native Count Finish is an event and cannot settle a pending finish request", async () => {
  const h = harness();
  const events = [];
  const unsubscribe = h.annotations.count.onFinished((event) => events.push(event));
  const config = {
    visibility: "selected",
    content: "nameValue",
    symbol: "🟡",
    numbered: true
  };
  const configuring = h.annotations.count.configure(config);
  assert.equal(h.sent.at(-1).payload.options.symbol, "🟡");
  h.reply("countConfigured");
  await configuring;

  const pending = h.annotations.count.finish({ requestId: "finish" });
  h.emit("countFinished", { success: true });
  assert.deepEqual(events, [{ success: true }]);
  assert.equal(h.listeners.get("countFinished").size, 2);
  h.reply("countFinished");
  await pending;
  assert.equal(events.length, 1);
  unsubscribe();
  h.annotations.disconnect();
  assert.equal(h.listeners.get("countFinished").size, 0);
});

test("Count item APIs preserve native marker identity and reject invalid metadata before sending", async () => {
  const h = harness();
  const guid = "count-guid";
  const item = {
    id: "marker-id",
    index: 0,
    point: { x: 12, y: -4 },
    info: { reference: "A-01" }
  };
  const data = { guid, coordinateSpace: "nativeAnnotation", items: [item] };

  for (const info of [
    { nested: { x: 1 } },
    { value: Infinity },
    JSON.parse('{"__proto__":null}')
  ]) {
    await assert.rejects(
      h.annotations.count.setItemInfo(guid, item.id, info),
      /Invalid Count/
    );
  }
  assert.equal(h.sent.length, 0);

  const pending = h.annotations.count.getItems(guid);
  h.reply("countItems", data);
  assert.deepEqual((await pending).items, [item]);

  const update = h.annotations.count.setItemInfo(guid, item.id, { checked: true });
  assert.equal(h.sent.at(-1).payload.itemId, item.id);
  h.reply("countItemInfoChanged", {
    ...data,
    items: [{ ...item, info: { checked: true } }]
  });
  assert.deepEqual((await update).items[0].info, { checked: true });
});

test("older Canvas retains legacy Count insertion while new commands require advertised capabilities", async () => {
  const h = harness([]);
  await assert.rejects(h.tools.getState(), { code: "CAPABILITY_NOT_SUPPORTED" });
  await assert.rejects(h.annotations.redo(), { code: "CAPABILITY_NOT_SUPPORTED" });
  await assert.rejects(h.annotations.count.finish(), {
    code: "CAPABILITY_NOT_SUPPORTED"
  });
  await assert.rejects(h.annotations.count.getItems("guid"), {
    code: "CAPABILITY_NOT_SUPPORTED"
  });
  assert.equal(h.sent.length, 0);

  h.annotations.setCountPointMode({ enabled: true, guid: "guid" });
  assert.equal(h.sent.at(-1).type, "insertCountPointMode");
  const pending = h.annotations.count.insertPoint();
  h.reply("insertCountPointResult", { markupNumber: 9, uniqueId: "guid" });
  assert.equal((await pending).markupNumber, 9);

  const mode = h.annotations.count.setPointMode({ enabled: false });
  assert.equal("guid" in h.sent.at(-1).payload, false);
  h.reply("insertCountPointModeResult", { enabled: false });
  assert.equal((await mode).enabled, false);
});

test("timeouts, send failure and disconnect remove listeners without retry", async () => {
  const h = harness();
  await assert.rejects(h.annotations.redo({ timeoutMs: 5 }), { code: "COMMAND_TIMEOUT" });
  assert.equal(h.sent.length, 1);
  assert.equal(h.listeners.get("annotationEditResult").size, 0);

  const unfinished = h.tools.getState();
  h.tools.disconnect();
  await assert.rejects(unfinished, { code: "VIEWER_NOT_READY" });
  assert.equal(h.listeners.get("parentToolState").size, 0);

  h.broker.send = () => {
    throw new Error("send failed");
  };
  await assert.rejects(h.annotations.count.finish(), /Could not send/);
  assert.equal(h.listeners.get("countFinished").size, 0);
});
