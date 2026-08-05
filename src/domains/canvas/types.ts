import type { CanvasMessageBroker } from "../../messaging/CanvasMessageBroker.js";

export interface CanvasApiOptions {
  getBroker: () => CanvasMessageBroker | null;
}
