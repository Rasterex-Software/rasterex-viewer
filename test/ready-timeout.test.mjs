import assert from "node:assert/strict";
import test from "node:test";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;

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

test("a settled readiness attempt cannot complete a later evaluation attempt", async (t) => {
  const { RasterexViewer } = await import("../dist/RasterexViewer.js");

  for (const interruptedBy of ["abort", "timeout"]) {
    for (const valid of [true, false]) {
      await t.test(`${interruptedBy} followed by ${valid ? "successful" : "failed"} validation`, async () => {
        installWindow();
        window.localStorage = { getItem: () => "stored-token" };
        let finishBody;
        let bodyStarted;
        const started = new Promise(resolve => { bodyStarted = resolve; });
        let calls = 0;
        globalThis.fetch = async () => {
          calls += 1;
          return {
            ok: true,
            status: 200,
            json: () => new Promise(resolve => {
              finishBody = resolve;
              bodyStarted();
            })
          };
        };
        const viewer = createUnreadyViewer(RasterexViewer, {
          viewerUrl: "https://sandbox.rasterex.com",
          readyTimeoutMs: interruptedBy === "timeout" ? 20 : 1000
        });
        viewer.messagingSession.canvasBroker.hasReceived = () => true;
        const controller = new AbortController();
        const first = viewer.ready({ signal: controller.signal });
        const rejected = assert.rejects(first, error => error.code === (
          interruptedBy === "abort" ? "VIEWER_NOT_READY" : "CANVAS_READY_TIMEOUT"
        ));
        await started;
        if (interruptedBy === "abort") controller.abort();
        await rejected;

        const second = viewer.ready();
        assert.equal(viewer.ready(), second);
        const outcome = valid ? second : assert.rejects(second, error => error.code === "EVALUATION_EXPIRED");
        finishBody(valid
          ? { valid: true, expires: "backend-expiry" }
          : { valid: false, reason: "EVALUATION_EXPIRED" });
        await outcome;
        assert.equal(viewer.getInfo().state, valid ? "ready" : "error");
        assert.equal(calls, 1);
      });
    }
  }
});

test("destroy cancels evaluation body consumption with the viewer lifecycle error", async () => {
  installWindow();
  window.localStorage = { getItem: () => "stored-token" };
  let bodyStarted;
  const started = new Promise(resolve => { bodyStarted = resolve; });
  let signal;
  globalThis.fetch = async (_url, options) => {
    signal = options.signal;
    return {
      ok: true,
      status: 200,
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        bodyStarted();
      })
    };
  };
  const { RasterexViewer } = await import("../dist/RasterexViewer.js");
  const viewer = createUnreadyViewer(RasterexViewer, { viewerUrl: "https://sandbox.rasterex.com" });
  viewer.messagingSession.canvasBroker.hasReceived = () => true;
  viewer.messagingSession.destroy = () => {};
  viewer.iframe.remove = () => {};
  const readiness = viewer.ready();
  const rejected = assert.rejects(readiness, error => {
    assert.equal(error.code, "VIEWER_NOT_READY");
    assert.match(error.message, /destroyed/);
    return true;
  });
  await started;
  viewer.destroy();
  await rejected;
  assert.equal(signal.aborted, true);
  assert.equal(viewer.getInfo().state, "destroyed");
});

test("internal bypass skips evaluation while preserving Canvas readiness", async (t) => {
  const { RasterexViewer } = await import("../dist/RasterexViewer.js");
  const key = "rx-internal-abf90527d2d42e3ccd5145623e6af5eaf564e783582e1a32";

  function bypassViewer(options = {}) {
    installWindow();
    Object.defineProperty(window, "localStorage", {
      get() { assert.fail("bypass must not access evaluation storage"); }
    });
    globalThis.fetch = async () => assert.fail("bypass must not call evaluation API");
    return createUnreadyViewer(RasterexViewer, {
      viewerUrl: "https://sandbox.rasterex.com/canvas?embed=true",
      evaluation: { internalBypassKey: key, company: "Internal", email: "internal@example.com" },
      readyTimeoutMs: 1000,
      ...options
    });
  }

  await t.test("waits for Canvas before resolving without storage or network access", async () => {
    const viewer = bypassViewer();
    let canvasReady;
    viewer.messagingSession.canvasBroker.on = (event, handler) => {
      assert.equal(event, "viewerReady");
      canvasReady = handler;
      return () => {};
    };
    let settled = false;
    const readiness = viewer.ready().then(() => { settled = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false);
    assert.equal(viewer.getInfo().state, "handshaking");
    canvasReady();
    await readiness;
    assert.equal(viewer.getInfo().state, "ready");
    assert.equal(JSON.stringify(viewer.getInfo()).includes(key), false);
  });

  await t.test("still times out if Canvas never becomes ready", async () => {
    const viewer = bypassViewer({ readyTimeoutMs: 10 });
    await assert.rejects(viewer.ready(), error => error.code === "CANVAS_READY_TIMEOUT");
    assert.equal(viewer.getInfo().state, "error");
  });

  await t.test("still honors cancellation", async () => {
    const viewer = bypassViewer();
    const controller = new AbortController();
    const readiness = viewer.ready({ signal: controller.signal });
    controller.abort();
    await assert.rejects(readiness, error => error.code === "VIEWER_NOT_READY");
    assert.equal(viewer.getInfo().state, "error");
  });

  for (const internalBypassKey of [undefined, "", "incorrect-key", ` ${key} `]) {
    await t.test(`nonmatching key ${JSON.stringify(internalBypassKey)} retains evaluation`, async () => {
      installWindow();
      let reads = 0;
      let calls = 0;
      window.localStorage = { getItem: () => { reads += 1; return "expired-token"; } };
      globalThis.fetch = async (_url, options) => {
        calls += 1;
        assert.deepEqual(JSON.parse(options.body), { token: "expired-token" });
        return new Response(JSON.stringify({ valid: false, reason: "EVALUATION_EXPIRED" }));
      };
      const viewer = createUnreadyViewer(RasterexViewer, {
        viewerUrl: "https://sandbox.rasterex.com",
        evaluation: { internalBypassKey }
      });
      viewer.messagingSession.canvasBroker.hasReceived = () => true;
      await assert.rejects(viewer.ready(), error => error.code === "EVALUATION_EXPIRED");
      assert.equal(reads, 1);
      assert.equal(calls, 1);
    });
  }
});

test.after(() => {
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
});
