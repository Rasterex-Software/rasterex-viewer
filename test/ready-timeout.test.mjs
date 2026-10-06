import assert from "node:assert/strict";
import test from "node:test";

const originalWindow = globalThis.window;

function installWindow() {
  globalThis.window = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout
  };
}

function createUnreadyViewer(RasterexViewer, options = {}) {
  const viewer = new RasterexViewer({
    container: "#viewer",
    viewerUrl: "https://viewer.example.com/canvas",
    ...options
  });

  viewer.iframe = { isConnected: true };
  viewer.messagingSession = {
    transport: {
      onMessage: () => () => {}
    },
    canvasBroker: {
      hasReceived: () => false,
      on: () => () => {}
    }
  };

  return viewer;
}

test("ready rejects with Canvas timeout context when Canvas never becomes ready", async () => {
  installWindow();
  const { RasterexViewer } = await import("../dist/RasterexViewer.js");
  const viewer = createUnreadyViewer(RasterexViewer, { readyTimeoutMs: 10 });

  await assert.rejects(viewer.ready(), (error) => {
    assert.equal(error.code, "CANVAS_READY_TIMEOUT");
    assert.equal(error.context.timeoutMs, 10);
    assert.equal(error.context.viewerUrl, "https://viewer.example.com/canvas");
    assert.match(error.message, /viewer\.example\.com\/canvas/);
    return true;
  });
  assert.equal(viewer.getInfo().state, "error");

  const retry = viewer.ready();
  await assert.rejects(retry, (error) => error.code === "CANVAS_READY_TIMEOUT");
});

test("ready rejects immediately when its AbortSignal is aborted", async () => {
  installWindow();
  const { RasterexViewer } = await import("../dist/RasterexViewer.js");
  const viewer = createUnreadyViewer(RasterexViewer, { readyTimeoutMs: 10_000 });
  const controller = new AbortController();
  const readiness = viewer.ready({ signal: controller.signal });

  controller.abort();

  await assert.rejects(readiness, (error) => {
    assert.equal(error.code, "VIEWER_NOT_READY");
    assert.equal(error.context.stage, "ready");
    assert.equal(error.context.reason, "aborted");
    return true;
  });
  assert.equal(viewer.getInfo().state, "error");
});

test.after(() => {
  globalThis.window = originalWindow;
});
