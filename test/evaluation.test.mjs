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

    const result = await new EvaluationService({
      company: "Example Company",
      email: "user@example.com"
    }).initialize();

    assert.equal(result.expires, "2026-09-17T11:48:06.069Z");
    assert.equal(storage.get("rx_viewspace_evaluation_token"), "evaluation-token");
    assert.equal(calls.length, 2);
    assert.deepEqual(JSON.parse(calls[1].body), { token: "evaluation-token" });
  });

  await t.test("uses an existing token without registering again", async () => {
    let calls = 0;
    installBrowser({
      token: "stored-token",
      fetch: async () => {
        calls += 1;
        return json({ valid: true, expires: "2026-09-17T11:48:06.069Z", reason: null });
      }
    });

    await new EvaluationService().initialize();
    assert.equal(calls, 1);
  });

  await t.test("registers without company or email details", async () => {
    const calls = [];
    installBrowser({
      fetch: async (url, options) => {
        calls.push({ url, body: options.body });
        return calls.length === 1
          ? json({ token: "anonymous-token", expires: "2026-09-17T11:48:06.069Z" })
          : json({ valid: true, expires: "2026-09-17T11:48:06.069Z", reason: null });
      }
    });

    await new EvaluationService().initialize();
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

test.after(() => {
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
});
