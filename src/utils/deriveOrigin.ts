export function deriveOrigin(viewerUrl: string): string {
  return new URL(viewerUrl).origin;
}
