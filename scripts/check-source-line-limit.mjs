import { readdir, readFile } from "node:fs/promises";

const MAX_LINES = 500;
const sourceRoot = new URL("../src/", import.meta.url);
const legacyLineBaselines = new Map([
  ["RasterexViewer.ts", 533],
  ["domains/AnnotationsApi.ts", 537],
  ["domains/MeasurementsApi.ts", 601],
  ["domains/ToolsApi.ts", 620]
]);
const sourceFiles = await findTypeScriptFiles(sourceRoot);
const violations = [];

for (const file of sourceFiles) {
  const content = await readFile(file, "utf8");
  const lineCount = content.split("\n").length;
  const relativePath = decodeURIComponent(file.pathname).slice(
    decodeURIComponent(sourceRoot.pathname).length
  );
  const maximum = legacyLineBaselines.get(relativePath) ?? MAX_LINES;

  if (lineCount > maximum) {
    violations.push({ file, lineCount, maximum });
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(
      `${violation.file.pathname}: ${violation.lineCount} lines (maximum ${violation.maximum})`
    );
  }
  process.exitCode = 1;
}

async function findTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const file = new URL(entry.name, directory);

    if (entry.isDirectory()) {
      files.push(...(await findTypeScriptFiles(new URL(`${entry.name}/`, directory))));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(file);
    }
  }

  return files;
}
