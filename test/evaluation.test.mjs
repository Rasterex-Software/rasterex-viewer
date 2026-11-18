import assert from "node:assert/strict";
import test from "node:test";

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;

function installBrowser({ token = null, fetch }) {
  const values = new Map();

  if (token) {
    values.set("rx_viewspace_evaluation_token", token);
  }

  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value)
    },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout
  };
  globalThis.fetch = fetch;

  return values;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function stalledResponse(signal, onAbort = () => {}) {
  return new Response(new ReadableStream({
    start(controller) {
      signal.addEventListener("abort", () => {
        onAbort();
        controller.error(new DOMException("Request aborted", "AbortError"));
      }, { once: true });
    }
  }), { headers: { "Content-Type": "application/json" } });
}

test("evaluation request timeout and destroy cover response bodies", async (t) => {
  const { EvaluationService } = await import("../dist/evaluation/EvaluationService.js");

  for (const token of [null, "stored-token"]) {
    const stage = token ? "validation" : "activation";

    await t.test(`${stage} times out while consuming the body`, async () => {
      let calls = 0;
      let aborts = 0;
      installBrowser({ token, fetch: async (_url, options) => {
        calls += 1;
        return stalledResponse(options.signal, () => { aborts += 1; });
      } });
      window.setTimeout = (callback, ms) => setTimeout(callback, ms === 10_000 ? 5 : 0);

      await assert.rejects(new EvaluationService().initialize(), (error) => {
        assert.equal(error.code, token ? "EVALUATION_VALIDATION_FAILED" : "EVALUATION_ACTIVATION_FAILED");
        assert.equal(error.context.timeoutMs, 10_000);
        return true;
      });
      assert.equal(calls, token ? 3 : 1);
      assert.equal(aborts, calls);
    });

    await t.test(`destroy aborts ${stage} body consumption`, async () => {
      let bodyStarted;
      const started = new Promise(resolve => { bodyStarted = resolve; });
      let signal;
      let calls = 0;
      installBrowser({ token, fetch: async (_url, options) => {
        calls += 1;
        signal = options.signal;
        return {
          ok: true,
          status: 200,
          json() {
            bodyStarted();
            return stalledResponse(signal).json();
          }
        };
      } });

      const service = new EvaluationService();
      const pending = service.initialize();
      await started;
      service.destroy();
      assert.equal(signal.aborted, true);
      await assert.rejects(pending);
      assert.equal(calls, 1);
    });
  }

  await t.test("retries a network failure while reading a validation body", async () => {
    let calls = 0;
    installBrowser({ token: "stored-token", fetch: async () => {
      calls += 1;
      return calls === 1
        ? new Response(new ReadableStream({ start(controller) { controller.error(new TypeError("connection lost")); } }))
        : json({ valid: true, expires: "backend-expiry" });
    } });
    window.setTimeout = (callback, ms) => setTimeout(callback, ms === 10_000 ? ms : 0);
    await new EvaluationService().initialize();
    assert.equal(calls, 2);
  });

  await t.test("does not retry malformed validation JSON", async () => {
    let calls = 0;
    installBrowser({ token: "stored-token", fetch: async () => {
      calls += 1;
      return new Response("{invalid");
    } });
    await assert.rejects(new EvaluationService().initialize(), error => error.code === "EVALUATION_VALIDATION_FAILED");
    assert.equal(calls, 1);
  });

  await t.test("preserves permanent HTTP failure without reading its broken body", async () => {
    let calls = 0;
    installBrowser({ token: "stored-token", fetch: async () => {
      calls += 1;
      return new Response(new ReadableStream({
        start(controller) { controller.error(new TypeError("connection lost")); }
      }), { status: 403 });
    } });
    await assert.rejects(new EvaluationService().initialize(), error => {
      assert.equal(error.code, "EVALUATION_VALIDATION_FAILED");
      assert.equal(error.context.status, 403);
      return true;
    });
    assert.equal(calls, 1);
  });
});

test("evaluation activation and validation lifecycle", async (t) => {
  const { EvaluationService } = await import("../dist/evaluation/EvaluationService.js");

  await t.test("activates once, persists the token, then validates it", async () => {
    const calls = [];
    const storage = installBrowser({
      fetch: async (url, options) => {
        calls.push({ url, body: options.body });
        return calls.length === 1
          ? json({ token: "evaluation-token", expires: "2026-09-17T11:48:06.069Z" })
          : json({ valid: true, expires: "2026-09-17T11:48:06.069Z", reason: null });
      }
    });

    const result = await new EvaluationService().initialize();

    assert.equal(result.expires, "2026-09-17T11:48:06.069Z");
    assert.equal(storage.get("rx_viewspace_evaluation_token"), "evaluation-token");
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/activate$/);
    assert.deepEqual(JSON.parse(calls[0].body), {});
    assert.deepEqual(JSON.parse(calls[1].body), { token: "evaluation-token" });
  });

  await t.test("uses an existing token without creating a replacement when registration details are supplied", async () => {
    const calls = [];
    installBrowser({
      token: "stored-token",
      fetch: async (url, options) => {
        calls.push({ url, body: options.body });
        return json({ valid: true, expires: "2026-09-17T11:48:06.069Z", reason: null });
      }
    });

    await new EvaluationService({ company: "Example Company", email: "user@example.com" }).initialize();
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/validate$/);
    assert.deepEqual(JSON.parse(calls[0].body), { token: "stored-token" });
  });

  await t.test("uses anonymous activation when registration details are absent or incomplete", async () => {
    const calls = [];
    installBrowser({
      fetch: async (url, options) => {
        calls.push({ url, body: options.body });
        return calls.length === 1
          ? json({ token: "anonymous-token", expires: "2026-09-17T11:48:06.069Z" })
          : json({ valid: true, expires: "2026-09-17T11:48:06.069Z", reason: null });
      }
    });

    await new EvaluationService({ company: "Example Company" }).initialize();
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/activate$/);
    assert.deepEqual(JSON.parse(calls[0].body), {});
  });

  await t.test("uses registration when company and email are supplied", async () => {
    const calls = [];
    installBrowser({
      fetch: async (url, options) => {
        calls.push({ url, body: options.body });
        return calls.length === 1
          ? json({ token: "registered-token", expires: "2026-09-17T11:48:06.069Z" })
          : json({ valid: true, expires: "2026-09-17T11:48:06.069Z", reason: null });
      }
    });

    await new EvaluationService({ company: "Example Company", email: " user@example.com " }).initialize();
    assert.match(calls[0].url, /\/register$/);
    assert.deepEqual(JSON.parse(calls[0].body), {
      company: "Example Company",
      email: "user@example.com"
    });
  });

  await t.test("retains an invalid token and rejects with its backend code", async () => {
    const storage = installBrowser({
      token: "edited-token",
      fetch: async () => json({ valid: false, reason: "INVALID_TOKEN" })
    });

    await assert.rejects(
      new EvaluationService().initialize(),
      (error) => error.code === "INVALID_TOKEN"
    );
    assert.equal(storage.get("rx_viewspace_evaluation_token"), "edited-token");
  });

  await t.test("does not retry registration when the request fails", async () => {
    let calls = 0;
    installBrowser({
      fetch: async () => {
        calls += 1;
        throw new TypeError("network unavailable");
      }
    });

    const service = new EvaluationService({
      company: "Example Company",
      email: "user@example.com"
    });
    await assert.rejects(
      service.initialize(),
      (error) => error.code === "EVALUATION_REGISTRATION_FAILED"
    );
    await assert.rejects(service.initialize());
    assert.equal(calls, 1);
  });

  await t.test("does not retry anonymous activation when the request fails", async () => {
    let calls = 0;
    installBrowser({
      fetch: async () => {
        calls += 1;
        throw new TypeError("network unavailable");
      }
    });

    await assert.rejects(
      new EvaluationService().initialize(),
      (error) => error.code === "EVALUATION_ACTIVATION_FAILED"
    );
    assert.equal(calls, 1);
  });

  await t.test("retries a transient validation failure before succeeding", async () => {
    let calls = 0;
    installBrowser({
      token: "stored-token",
      fetch: async () => {
        calls += 1;

        if (calls === 1) {
          throw new TypeError("temporary network error");
        }

        return json({ valid: true, expires: "2026-09-17T11:48:06.069Z", reason: null });
      }
    });

    await new EvaluationService().initialize();
    assert.equal(calls, 2);
  });
});

test("hosted Sandbox detection controls the evaluation boundary", async () => {
  const { isSandboxViewerUrl } = await import("../dist/utils/isSandboxViewerUrl.js");

  assert.equal(isSandboxViewerUrl("https://sandbox.rasterex.com"), true);
  assert.equal(isSandboxViewerUrl("https://sandbox.rasterex.com/canvas?embed=true"), true);
  assert.equal(isSandboxViewerUrl("https://viewer.example.com/rasterex"), false);
  assert.equal(isSandboxViewerUrl("http://sandbox.rasterex.com"), false);
});

test.after(() => {
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
});
