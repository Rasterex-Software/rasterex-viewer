export type CompatibilityState =
  | "compatible"
  | "degraded"
  | "incompatible";

export interface CompatibilityResult {
  state: CompatibilityState;
  reason?: string;
  unsupportedCapabilities?: readonly string[];
}
