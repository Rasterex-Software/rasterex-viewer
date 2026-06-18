let sdkInstanceCounter = 0;

export function createSdkInstanceId(): string {
  sdkInstanceCounter += 1;

  return `viewer-${Date.now().toString(36)}-${sdkInstanceCounter.toString(36)}`;
}
