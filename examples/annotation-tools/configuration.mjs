/** Rewrite active connection declarations only; never alter the engine or replies. */
export function readUploadPaths(source) {
  return Object.fromEntries(["UploadServerfolder", "UploadServerfolderd", "baseFileURL"].map(name => {
    const match = source.match(new RegExp(`^[ \\t]*var ${name}\\s*=\\s*("(?:[^"\\\\]|\\\\.)*")`, "m"));
    if (!match) throw new Error(`Rasterex server configuration does not declare ${name}`);
    return [name, JSON.parse(match[1])];
  }));
}

export function connectionOverlay(source, nativeBase, apiBase, uploadPaths = {}, cacheBase) {
  let config = source;
  for (const [name, value] of [["baseURL", nativeBase], ["apiBaseURL", apiBase],
    ...["UploadServerfolder", "UploadServerfolderd", "baseFileURL"].filter(name => name in uploadPaths).map(name => [name, uploadPaths[name]])]) {
    const pattern = new RegExp(`^([ \\t]*)var ${name}\\s*=\\s*(?:"(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')`, "m");
    if (!pattern.test(config)) throw new Error(`Expected active Canvas configuration field ${name} was not found`);
    config = config.replace(pattern, (_match, indent) => `${indent}var ${name} = ${JSON.stringify(value)}`);
  }
  if (cacheBase) config += `\nRxConfig.xmlurlrel = ${JSON.stringify(cacheBase)};\nRxConfig.xmlurlrelmarkup = ${JSON.stringify(cacheBase)};\n`;
  return config;
}
