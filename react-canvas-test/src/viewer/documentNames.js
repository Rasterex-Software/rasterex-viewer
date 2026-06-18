export function getDisplayName(url) {
  return url.split(/[\\/]/).filter(Boolean).pop() || "document";
}

