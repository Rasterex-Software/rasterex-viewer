import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const keywords = packageJson.keywords;
const normalizedDescription = packageJson.description.toLowerCase();

assert.equal(typeof packageJson.description, "string");
assert.ok(packageJson.description.length >= 80, "Description is too short for package discovery");
assert.ok(packageJson.description.length <= 300, "Description is too long for package discovery");
assert.ok(Array.isArray(keywords) && keywords.length > 0, "Keywords are required");
assert.equal(new Set(keywords).size, keywords.length, "Keywords must be unique");
assert.ok(keywords.every(keyword => typeof keyword === "string" && keyword.trim() && keyword === keyword.toLowerCase()), "Keywords must be non-empty lowercase strings");
assert.ok(keywords.every(keyword => keyword.length <= 50), "Keywords must be concise");

for (const term of ["dwg", "dxf", "dgn", "ifc", "pdf", "typescript", "drawing comparison"]) {
  assert.ok(normalizedDescription.includes(term), `Description must mention ${term}`);
}

console.log(`Package metadata verified: ${keywords.length} unique keywords`);
