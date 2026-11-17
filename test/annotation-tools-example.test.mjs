import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { connectionOverlay, readUploadPaths } from "../examples/annotation-tools/configuration.mjs";

test("local connection overlay targets active settings after commented alternatives", () => {
  const source = `// var baseURL = "https://comment.example/";
  var baseURL = "http://localhost/";
  // var apiBaseURL = "https://comment-api.example/";
  var apiBaseURL = "http://localhost:5203/";
  var engineUnchanged = "native";`;
  const overlaid = connectionOverlay(source, "http://127.0.0.1:4201/rasterex/", "http://127.0.0.1:4201/rasterex-api/");
  assert.ok(overlaid.includes('// var baseURL = "https://comment.example/";'));
  const context = vm.createContext({});
  vm.runInContext(overlaid, context);
  assert.equal(context.baseURL, "http://127.0.0.1:4201/rasterex/");
  assert.equal(context.apiBaseURL, "http://127.0.0.1:4201/rasterex-api/");
  assert.equal(context.engineUnchanged, "native");
  assert.throws(() => connectionOverlay('// var baseURL = "only-comment";', "native", "api"));
});

test("local overlay preserves actual server Windows upload-path escaping", () => {
  const paths = { UploadServerfolder: "E:\\Rasterex\\Upload\\", UploadServerfolderd: "E:\\\\Rasterex\\\\Upload\\\\", baseFileURL: "E:\\\\Rasterex\\\\Upload\\\\" };
  const declarations = Object.entries(paths).map(([name, value]) => `var ${name} = ${JSON.stringify(value)};`).join("\n");
  assert.deepEqual(readUploadPaths(declarations), paths);
  assert.throws(() => readUploadPaths('var baseFileURL = someFunction();'));
  const source = 'var baseURL = "old";\nvar apiBaseURL = "old";\n' + declarations.replaceAll("E:", "C:");
  const config = connectionOverlay(source, "native", "api", paths);
  const context = vm.createContext({});
  vm.runInContext(config, context);
  for (const [name, value] of Object.entries(paths)) assert.equal(context[name], value);
});

test("cache paths remain relative so native URL encoding cannot corrupt an authority port", () => {
  const source = 'var baseURL = "old";\nvar apiBaseURL = "old";\nvar RxConfig = {};';
  const overlaid = connectionOverlay(source, "http://canvas.localhost:4201/rasterex/", "api", {}, "/rasterex/RxBinweb");
  const context = vm.createContext({});
  vm.runInContext(overlaid, context);
  assert.equal(context.RxConfig.xmlurlrel, "/rasterex/RxBinweb");
  assert.equal(new URL(context.RxConfig.xmlurlrel + "/cache/fixture.pdf", "http://canvas.localhost:4201").port, "4201");
});
